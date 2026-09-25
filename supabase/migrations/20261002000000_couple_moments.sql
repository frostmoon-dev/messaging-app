-- Couple moments: "Thinking of you", anniversaries and "On this day".
--
--   * "Thinking of you" is a new alert kind ('love'): one tap, a soft
--     heartbeat and a pop-up on the other phone. Same flood guard as
--     "I'm here" (3 a minute).
--   * Anniversaries (1 month, 100 days, 6 months, every year, 500 days and
--     every 1,000 days) and "On this day" memories pop up on both phones
--     at about 09:00 your time. send-push works out what's due; this file
--     only runs it every hour and remembers what was sent.
--
-- Needs the send-push function redeployed after this runs.

-- ---------------------------------------------------------------------------
-- "Thinking of you"
-- ---------------------------------------------------------------------------

alter table public.alerts drop constraint alerts_kind_check;
alter table public.alerts
  add constraint alerts_kind_check check (kind in ('sos', 'here', 'where', 'love'));

-- ---------------------------------------------------------------------------
-- Anniversaries and "On this day"
-- ---------------------------------------------------------------------------

-- One row per moment already sent, so each is sent once, even if the hourly
-- job runs twice or the function is retried.
create table public.moments_sent (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- "years:2", "days:100", "otd:2026-09-25"
  key             text not null check (char_length(key) between 1 and 60),
  sent_at         timestamptz not null default now(),
  primary key (conversation_id, key)
);

alter table public.moments_sent enable row level security;
-- No policies and no grants: only send-push (secret key) uses it.
revoke all on public.moments_sent from anon, authenticated;

-- Memories from this day in earlier years. Runs as the caller, so the usual
-- read policy decides what they see. 29 February memories show on
-- 28 February in other years.
create function public.memories_on_this_day(conv uuid, today date)
returns setof public.memories
language sql
stable
security invoker
set search_path = ''
as $$
  select *
    from public.memories m
   where m.conversation_id = conv
     and m.memory_date < today
     and (
       (extract(month from m.memory_date) = extract(month from today)
        and extract(day from m.memory_date) = extract(day from today))
       or (extract(month from m.memory_date) = 2 and extract(day from m.memory_date) = 29
           and extract(month from today) = 2 and extract(day from today) = 28
           and extract(day from (date_trunc('year', today) + interval '2 months - 1 day')) = 28)
     )
   order by m.memory_date asc, m.created_at asc
   limit 20;
$$;

revoke execute on function public.memories_on_this_day(uuid, date) from public, anon;
grant execute on function public.memories_on_this_day(uuid, date) to authenticated;

-- Every hour at :05. send-push only sends once it's 09:00 or later where
-- you are, and only once per moment.
select cron.schedule('napyru-moments', '5 * * * *', $$select public.queue_push('{"moments": true}'::jsonb)$$);
