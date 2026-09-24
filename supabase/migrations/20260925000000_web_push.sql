-- ============================================================================
-- Web Push: notify the other person when a message arrives, even when the
-- app is closed.
--
--   1. Each device saves its push address (endpoint + keys) through
--      save_push_subscription(). Clients never touch the table directly.
--   2. After a message is inserted, a trigger queues an HTTP call (pg_net)
--      to the `send-push` Edge Function with only the message id.
--   3. The function looks up the recipient's devices and sends the push.
--
-- The trigger reads the function URL and a shared secret from Vault:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<random secret>', 'push_webhook_secret');
-- Until both exist the trigger does nothing, so messaging never depends on
-- push being set up.
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists supabase_vault;

create table public.push_subscriptions (
  -- The push service URL for one browser on one device. Unique per device.
  endpoint   text primary key
               check (char_length(endpoint) between 12 and 1000 and endpoint like 'https://%'),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) between 1 and 200),
  auth       text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- No policies and no grants: only the functions below and the Edge Function
-- (secret key) can read or write push addresses.
revoke all on public.push_subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client functions
-- ---------------------------------------------------------------------------

-- Saves (or moves) this device's push address to the signed-in user.
-- A device that switches accounts moves its row to the new account.
-- Keeps at most 10 devices per user; the oldest are dropped.
create function public.save_push_subscription(sub_endpoint text, sub_p256dh text, sub_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (sub_endpoint, me, sub_p256dh, sub_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        created_at = now();

  delete from public.push_subscriptions
  where user_id = me
    and endpoint not in (
      select endpoint from public.push_subscriptions
      where user_id = me
      order by created_at desc
      limit 10
    );
end;
$$;

-- Removes this device's push address (turning notifications off, signing out).
create function public.delete_push_subscription(sub_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_subscriptions
  where endpoint = sub_endpoint
    and user_id = (select auth.uid());
end;
$$;

revoke execute on function
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text)
  from public, anon;

grant execute on function
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: queue a push after each new message
-- ---------------------------------------------------------------------------

create function public.queue_message_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  fn_secret text;
begin
  select decrypted_secret into fn_url
  from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into fn_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret';

  if fn_url is null or fn_secret is null then
    return null;
  end if;

  -- pg_net sends the request after the transaction commits, so a slow or
  -- failing push never delays or blocks the message itself.
  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object('message_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', fn_secret
    ),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  raise warning 'queue_message_push failed: %', sqlerrm;
  return null;
end;
$$;

create trigger messages_after_insert_push
  after insert on public.messages
  for each row execute function public.queue_message_push();

revoke execute on function public.queue_message_push() from public, anon, authenticated;
