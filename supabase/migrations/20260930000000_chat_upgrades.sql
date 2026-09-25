-- Chat upgrades: honest "last seen", no notifications while you're in the
-- chat, message text in notifications (can be turned off), edits within 15
-- minutes, reactions, and message styles.

-- ---------------------------------------------------------------------------
-- Presence: a light heartbeat while the app is open
-- ---------------------------------------------------------------------------
-- The app calls heartbeat() about every 30 s while it's on screen. It keeps
-- last_seen current even when a phone suspends the app before it can say
-- goodbye, and chat_open_until tells send-push not to notify someone who is
-- looking at the chat. If the app is killed, chat_open_until simply expires.

alter table public.profiles add column chat_open_until timestamptz;
-- Show the message text in pop-up notifications (on by default; Settings).
alter table public.profiles add column notification_preview boolean not null default true;

grant update (notification_preview) on public.profiles to authenticated;

create function public.heartbeat(in_chat boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set last_seen = now(),
         chat_open_until = case when in_chat then now() + interval '75 seconds' else null end
   where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Messages: edits and styles
-- ---------------------------------------------------------------------------

alter table public.messages add column edited_at timestamptz;
alter table public.messages
  add column style text check (style in ('script', 'big', 'whisper', 'mono'));

grant insert (style) on public.messages to authenticated;

-- Your own text message, within 15 minutes of sending it.
create function public.edit_message(msg uuid, new_content text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := btrim(coalesce(new_content, ''), E' \t\r\n');
  edited timestamptz;
begin
  if cleaned = '' or char_length(cleaned) > 4000 then
    raise exception 'INVALID' using hint = 'A message needs 1 to 4000 characters.';
  end if;
  update public.messages
     set content = cleaned,
         edited_at = now()
   where id = msg
     and sender_id = auth.uid()
     and message_type = 'text'
     and deleted_at is null
     and created_at > now() - interval '15 minutes'
  returning edited_at into edited;
  if edited is null then
    raise exception 'TOO_LATE' using hint = 'Messages can be edited for 15 minutes.';
  end if;
  return edited;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reactions: one per person per message, shared with both of you
-- ---------------------------------------------------------------------------
-- Removing a reaction sets emoji to null instead of deleting the row, so the
-- change reaches the other phone as a live UPDATE (filtered deletes aren't
-- delivered).

create table public.message_reactions (
  message_id      uuid not null references public.messages (id) on delete cascade,
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  emoji           text check (emoji is null or char_length(emoji) between 1 and 16),
  updated_at      timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_reactions_conversation_idx on public.message_reactions (conversation_id);

alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;

create policy "message_reactions: members read"
  on public.message_reactions for select to authenticated
  using (public.is_conversation_member(conversation_id));

create function public.set_reaction(msg uuid, reaction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv uuid;
begin
  select m.conversation_id into conv
    from public.messages m
   where m.id = msg and m.deleted_at is null;
  if conv is null or not public.is_conversation_member(conv) then
    raise exception 'NOT_FOUND' using hint = 'That message is gone.';
  end if;
  if reaction is not null and (char_length(reaction) not between 1 and 16) then
    raise exception 'INVALID';
  end if;
  insert into public.message_reactions (message_id, user_id, conversation_id, emoji, updated_at)
  values (msg, auth.uid(), conv, reaction, now())
  on conflict (message_id, user_id)
  do update set emoji = excluded.emoji, updated_at = now();
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.heartbeat(boolean),
  public.edit_message(uuid, text),
  public.set_reaction(uuid, text)
  from public, anon;

grant execute on function
  public.heartbeat(boolean),
  public.edit_message(uuid, text),
  public.set_reaction(uuid, text)
  to authenticated;
