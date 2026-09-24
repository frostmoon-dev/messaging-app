-- ============================================================================
-- Shared calendar with reminders, live location, and alerts (SOS, "I'm
-- here", "Where are you?"). All of it notifies through the same send-push
-- Edge Function as messages.
--
-- Needs the pg_cron extension for reminders (Dashboard → Database →
-- Extensions → pg_cron). The Web Push Vault secrets from
-- 20260925000000_web_push.sql are reused; until they exist nothing is sent.
-- ============================================================================

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Shared helper: queue a call to send-push with a small JSON body
-- ---------------------------------------------------------------------------

create function public.queue_push(body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  fn_secret text;
begin
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into fn_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if fn_url is null or fn_secret is null then
    return;
  end if;
  perform net.http_post(
    url := fn_url,
    body := body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', fn_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  -- A notification problem must never undo the action that caused it.
  raise warning 'queue_push failed: %', sqlerrm;
end;
$$;

revoke execute on function public.queue_push(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------

create table public.events (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 80),
  note            text check (char_length(note) <= 500),
  starts_at       timestamptz not null,
  all_day         boolean not null default false,
  -- Minutes before starts_at to remind both of you; null = no reminder.
  remind_minutes  integer check (remind_minutes in (0, 10, 30, 60, 120, 1440)),
  -- Set by the trigger below (a generated column can't do time maths).
  remind_at       timestamptz,
  reminded_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index events_conversation_starts_idx on public.events (conversation_id, starts_at);
create index events_due_idx on public.events (remind_at) where reminded_at is null;

-- Works out when to remind. Moving an event or changing its reminder
-- re-arms the reminder.
create function public.before_event_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.remind_at := case
    when new.remind_minutes is null then null
    else new.starts_at - new.remind_minutes * interval '1 minute'
  end;
  if tg_op = 'INSERT' then
    new.reminded_at := null;
  elsif new.starts_at is distinct from old.starts_at or new.remind_minutes is distinct from old.remind_minutes then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

create trigger events_before_write
  before insert or update on public.events
  for each row execute function public.before_event_write();

-- Runs every minute (pg_cron). Sends each due reminder once. Reminders more
-- than an hour late (the scheduler was down) are marked done without a push.
create function public.dispatch_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due record;
  sent integer := 0;
begin
  for due in
    update public.events
       set reminded_at = now()
     where reminded_at is null
       and remind_at is not null
       and remind_at <= now()
    returning id, remind_at
  loop
    if due.remind_at > now() - interval '1 hour' then
      perform public.queue_push(jsonb_build_object('event_id', due.id));
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.dispatch_due_reminders() from public, anon, authenticated;
revoke execute on function public.before_event_write() from public, anon, authenticated;

select cron.schedule('napyru-reminders', '* * * * *', 'select public.dispatch_due_reminders()');

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select, delete on public.events to authenticated;
grant insert (id, conversation_id, title, note, starts_at, all_day, remind_minutes) on public.events to authenticated;
grant update (title, note, starts_at, all_day, remind_minutes) on public.events to authenticated;

create policy "events: members read"
  on public.events for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "events: members add as themselves"
  on public.events for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_conversation_member(conversation_id));

-- It's a shared calendar: either of you can fix or remove an entry.
create policy "events: members edit"
  on public.events for update to authenticated
  using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));

create policy "events: members delete"
  on public.events for delete to authenticated
  using (public.is_conversation_member(conversation_id));

-- ---------------------------------------------------------------------------
-- Live location: one row per person, only while they choose to share
-- ---------------------------------------------------------------------------

create table public.locations (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  accuracy        real check (accuracy >= 0 and accuracy <= 100000),
  updated_at      timestamptz not null default now()
);

alter table public.locations enable row level security;
revoke all on public.locations from anon, authenticated;
grant select on public.locations to authenticated;

create policy "locations: members read"
  on public.locations for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- Writes only through these two functions, and only for yourself.
create function public.share_location(conv uuid, lat double precision, lng double precision, accuracy real)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  stamp timestamptz := now();
begin
  if me is null or not public.is_conversation_member(conv) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.locations (user_id, conversation_id, lat, lng, accuracy, updated_at)
  values (me, conv, lat, lng, accuracy, stamp)
  on conflict (user_id) do update
    set conversation_id = excluded.conversation_id,
        lat = excluded.lat,
        lng = excluded.lng,
        accuracy = excluded.accuracy,
        updated_at = excluded.updated_at;
  return stamp;
end;
$$;

create function public.stop_sharing_location()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.locations where user_id = (select auth.uid());
$$;

revoke execute on function
  public.share_location(uuid, double precision, double precision, real),
  public.stop_sharing_location()
  from public, anon;
grant execute on function
  public.share_location(uuid, double precision, double precision, real),
  public.stop_sharing_location()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Alerts: SOS, "I'm here" (with location), "Where are you?"
-- ---------------------------------------------------------------------------

create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind            text not null check (kind in ('sos', 'here', 'where')),
  lat             double precision check (lat between -90 and 90),
  lng             double precision check (lng between -180 and 180),
  accuracy        real check (accuracy >= 0 and accuracy <= 100000),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles (id) on delete set null,
  constraint alerts_location_pair check ((lat is null) = (lng is null))
);

create index alerts_conversation_created_idx on public.alerts (conversation_id, created_at desc);
create index alerts_sender_recent_idx on public.alerts (sender_id, created_at desc);

-- Stops accidental floods (a stuck button, a pocket). SOS is never blocked.
create function public.before_alert_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.sender_id := (select auth.uid());
  new.created_at := now();
  new.resolved_at := null;
  new.resolved_by := null;
  if new.kind <> 'sos' and (
    select count(*) from public.alerts
    where sender_id = new.sender_id and kind = new.kind and created_at > now() - interval '1 minute'
  ) >= 3 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger alerts_before_insert
  before insert on public.alerts
  for each row execute function public.before_alert_insert();

create function public.queue_alert_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.queue_push(jsonb_build_object('alert_id', new.id));
  return null;
end;
$$;

create trigger alerts_after_insert_push
  after insert on public.alerts
  for each row execute function public.queue_alert_push();

-- Either of you can mark an SOS as handled ("I'm OK" / "I'm on it").
create function public.resolve_alert(alert uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.alerts
     set resolved_at = now(), resolved_by = (select auth.uid())
   where id = alert
     and resolved_at is null
     and public.is_conversation_member(conversation_id);
$$;

revoke execute on function
  public.before_alert_insert(),
  public.queue_alert_push()
  from public, anon, authenticated;
revoke execute on function public.resolve_alert(uuid) from public, anon;
grant execute on function public.resolve_alert(uuid) to authenticated;

alter table public.alerts enable row level security;
revoke all on public.alerts from anon, authenticated;
grant select on public.alerts to authenticated;
grant insert (id, conversation_id, kind, lat, lng, accuracy) on public.alerts to authenticated;

create policy "alerts: members read"
  on public.alerts for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "alerts: members send as themselves"
  on public.alerts for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

-- ---------------------------------------------------------------------------
-- Realtime: both of you see locations, alerts and calendar changes live.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.locations, public.alerts, public.events;
  end if;
end;
$$;
