-- Smarter pop-ups: quiet hours, reaction pop-ups (opt in), and SOS answers.
--
--   * Quiet hours: messages and reactions arrive silently between the times
--     you pick. SOS, "I'm here", "Where are you?" and reminders still ring.
--   * Reactions: a pop-up when your partner reacts to your message. Off by
--     default (Settings → Alerts).
--   * SOS: the sender gets a pop-up when the other person sees the SOS and
--     when they answer "I'm on it". An SOS nobody has seen rings again after
--     2, 4 and 6 minutes.
--
-- Needs the send-push function redeployed after this runs.

-- ---------------------------------------------------------------------------
-- Profile settings
-- ---------------------------------------------------------------------------

alter table public.profiles
  -- Minutes after local midnight (0–1439). Both null = no quiet hours.
  add column quiet_start smallint check (quiet_start between 0 and 1439),
  add column quiet_end smallint check (quiet_end between 0 and 1439),
  -- IANA name (e.g. Asia/Manila), so the server knows your local time.
  add column time_zone text check (char_length(time_zone) between 1 and 64),
  add column notify_reactions boolean not null default false,
  add constraint profiles_quiet_hours_pair check ((quiet_start is null) = (quiet_end is null));

grant update (quiet_start, quiet_end, time_zone, notify_reactions) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Reactions → pop-up for the person whose message it is
-- ---------------------------------------------------------------------------

create function public.queue_reaction_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
begin
  if new.emoji is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.emoji is not distinct from new.emoji then
    return null;
  end if;
  -- Only call the function when someone will actually get a pop-up.
  select m.sender_id into author
    from public.messages m
    join public.profiles p on p.id = m.sender_id
   where m.id = new.message_id
     and m.deleted_at is null
     and p.notify_reactions;
  if author is null or author = new.user_id then
    return null;
  end if;
  perform public.queue_push(jsonb_build_object('reaction_message_id', new.message_id, 'reactor_id', new.user_id));
  return null;
end;
$$;

create trigger message_reactions_after_write_push
  after insert or update of emoji on public.message_reactions
  for each row execute function public.queue_reaction_push();

-- ---------------------------------------------------------------------------
-- SOS: seen, answered, and repeated until seen
-- ---------------------------------------------------------------------------

alter table public.alerts
  add column seen_at timestamptz,
  add column seen_by uuid references public.profiles (id) on delete set null,
  add column sos_repeats smallint not null default 0 check (sos_repeats between 0 and 10);

-- The other person's app calls this when the SOS is on their screen.
create function public.mark_alert_seen(alert uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.alerts
     set seen_at = now(), seen_by = (select auth.uid())
   where id = alert
     and kind = 'sos'
     and seen_at is null
     and sender_id <> (select auth.uid())
     and public.is_conversation_member(conversation_id);
$$;

-- Same as before, and answering also counts as seeing it.
create or replace function public.resolve_alert(alert uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.alerts
     set resolved_at = now(),
         resolved_by = (select auth.uid()),
         seen_at = coalesce(seen_at, now()),
         seen_by = coalesce(seen_by, (select auth.uid()))
   where id = alert
     and resolved_at is null
     and public.is_conversation_member(conversation_id);
$$;

create function public.queue_sos_reply_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind <> 'sos' then
    return null;
  end if;
  if old.resolved_at is null and new.resolved_at is not null then
    -- The sender marking their own SOS as handled needs no pop-up.
    if new.resolved_by is distinct from new.sender_id then
      perform public.queue_push(jsonb_build_object('sos_handled_id', new.id));
    end if;
  elsif old.seen_at is null and new.seen_at is not null then
    perform public.queue_push(jsonb_build_object('sos_seen_id', new.id));
  end if;
  return null;
end;
$$;

create trigger alerts_after_update_push
  after update of seen_at, resolved_at on public.alerts
  for each row execute function public.queue_sos_reply_push();

-- Runs every minute (pg_cron). An SOS nobody has seen or answered rings
-- again 2, 4 and 6 minutes after it was sent, then stops.
create function public.dispatch_sos_repeats()
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
    update public.alerts
       set sos_repeats = sos_repeats + 1
     where kind = 'sos'
       and seen_at is null
       and resolved_at is null
       and sos_repeats < 3
       and created_at > now() - interval '30 minutes'
       and created_at <= now() - make_interval(mins => 2 * (sos_repeats + 1))
    returning id, sos_repeats
  loop
    perform public.queue_push(jsonb_build_object('alert_id', due.id, 'repeat', due.sos_repeats));
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

select cron.schedule('napyru-sos-repeats', '* * * * *', 'select public.dispatch_sos_repeats()');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.queue_reaction_push(),
  public.queue_sos_reply_push(),
  public.dispatch_sos_repeats()
  from public, anon, authenticated;

revoke execute on function public.mark_alert_seen(uuid) from public, anon;
grant execute on function public.mark_alert_seen(uuid) to authenticated;
