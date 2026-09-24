-- Delete a message for everyone, clear the chat for yourself, pin messages
-- for both of you, and star favourites for yourself.
--
-- * delete_message(msg): only the sender, only through this function. The
--   row stays as a "Message deleted" marker (so replies keep their place and
--   the other phone gets a live UPDATE), but its text, photo link and size
--   are wiped. Returns the photo's storage path so the app can remove the
--   file too.
-- * clear_chat(conv): hides every message up to now for the caller only.
--   The other person keeps their history. Enforced by the read policy, so
--   cleared messages never reach the app (or live updates) again.
-- * pin_message(msg, pinned): either of you pins or unpins any message;
--   both see the pins (at most 5; the oldest drops off). Deleting unpins.
-- * message_stars: your own favourites. Only you see what you starred.

-- ---------------------------------------------------------------------------
-- Delete for everyone
-- ---------------------------------------------------------------------------

alter table public.messages add column deleted_at timestamptz;
alter table public.messages add column pinned_at timestamptz;
alter table public.messages add column pinned_by uuid references public.profiles (id) on delete set null;

create index messages_pinned_idx
  on public.messages (conversation_id, pinned_at desc)
  where pinned_at is not null;

alter table public.messages drop constraint messages_body_check;
alter table public.messages
  add constraint messages_body_check check (
    (deleted_at is not null and content is null and image_url is null)
    or (
      deleted_at is null
      and (
        (message_type = 'text' and image_url is null and content ~ '\S')
        or (message_type = 'image' and image_url is not null and image_url !~ '^https://')
        or (message_type = 'sticker' and image_url is not null
            and (image_url !~ '^https://' or image_url ~ '^https://(media[0-9]*|i)\.giphy\.com/'))
        or (message_type = 'gif' and image_url is not null
            and image_url ~ '^https://(media[0-9]*|i)\.giphy\.com/')
      )
    )
  );

create function public.delete_message(msg uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_type text;
  old_path text;
begin
  select m.message_type, m.image_url
    into old_type, old_path
    from public.messages m
   where m.id = msg
     and m.sender_id = auth.uid()
     and m.deleted_at is null
     for update;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Only your own messages can be deleted.';
  end if;

  update public.messages
     set deleted_at = now(),
         pinned_at = null,
         pinned_by = null,
         content = null,
         image_url = null,
         image_width = null,
         image_height = null
   where id = msg;

  -- Only chat photos are this message's own file; stickers stay in the pack.
  return case when old_type = 'image' then old_path end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clear chat (for yourself)
-- ---------------------------------------------------------------------------

alter table public.conversation_members add column cleared_at timestamptz;

-- When the caller last cleared this chat (or the beginning of time).
create function public.chat_visible_since(conv uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select cm.cleared_at
       from public.conversation_members cm
      where cm.conversation_id = conv
        and cm.user_id = auth.uid()),
    '-infinity'::timestamptz
  );
$$;

create function public.clear_chat(conv uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleared timestamptz;
begin
  if not public.is_conversation_member(conv) then
    raise exception 'Not a member of this conversation';
  end if;
  update public.conversation_members
     set cleared_at = now()
   where conversation_id = conv
     and user_id = auth.uid()
  returning cleared_at into cleared;
  return cleared;
end;
$$;

drop policy "messages: members read" on public.messages;
create policy "messages: members read"
  on public.messages for select to authenticated
  using (
    public.is_conversation_member(conversation_id)
    and created_at > public.chat_visible_since(conversation_id)
  );

-- ---------------------------------------------------------------------------
-- Pins (shared)
-- ---------------------------------------------------------------------------

create function public.pin_message(msg uuid, pinned boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv uuid;
  at timestamptz;
begin
  select m.conversation_id into conv
    from public.messages m
   where m.id = msg and m.deleted_at is null;
  if conv is null or not public.is_conversation_member(conv) then
    raise exception 'NOT_FOUND' using hint = 'That message is gone.';
  end if;

  if pinned then
    update public.messages
       set pinned_at = now(), pinned_by = auth.uid()
     where id = msg
    returning pinned_at into at;
    -- Keep the five newest pins.
    update public.messages
       set pinned_at = null, pinned_by = null
     where conversation_id = conv
       and pinned_at is not null
       and id not in (
         select p.id from public.messages p
          where p.conversation_id = conv and p.pinned_at is not null
          order by p.pinned_at desc
          limit 5
       );
  else
    update public.messages set pinned_at = null, pinned_by = null where id = msg;
  end if;
  return at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stars (yours only)
-- ---------------------------------------------------------------------------

create table public.message_stars (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.message_stars enable row level security;
revoke all on public.message_stars from anon, authenticated;
grant select, delete on public.message_stars to authenticated;
grant insert (message_id) on public.message_stars to authenticated;

create policy "message_stars: own read"
  on public.message_stars for select to authenticated
  using (user_id = (select auth.uid()));

create policy "message_stars: star what you can see"
  on public.message_stars for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
       where m.id = message_id
         and m.deleted_at is null
         and public.is_conversation_member(m.conversation_id)
    )
  );

create policy "message_stars: own delete"
  on public.message_stars for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges: signed-in people only.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.pin_message(uuid, boolean),
  public.delete_message(uuid),
  public.clear_chat(uuid),
  public.chat_visible_since(uuid)
  from public, anon;

grant execute on function
  public.pin_message(uuid, boolean),
  public.delete_message(uuid),
  public.clear_chat(uuid),
  public.chat_visible_since(uuid)
  to authenticated;
