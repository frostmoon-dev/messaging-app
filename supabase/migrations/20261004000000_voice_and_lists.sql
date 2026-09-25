-- Voice messages, and shared lists (groceries, to-dos, bucket list…) in Plans.

-- ============================================================================
-- Voice messages
-- ============================================================================
-- The recording lives in the private `voice` bucket under the conversation's
-- folder (same rules as chat photos); image_url holds its path. The length
-- and a small waveform (one digit 0–9 per bar) are stored so the bubble can
-- draw itself before the audio loads.

alter table public.messages
  add column audio_duration_ms integer check (audio_duration_ms between 0 and 600000),
  add column audio_peaks text check (audio_peaks ~ '^[0-9]{0,64}$');

grant insert (audio_duration_ms, audio_peaks) on public.messages to authenticated;

alter table public.messages drop constraint messages_message_type_check;
alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'sticker', 'gif', 'voice'));

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
        or (message_type = 'voice' and image_url is not null and image_url !~ '^https://')
      )
    )
  );

-- Same as before, and a voice message's recording is its own file too.
create or replace function public.delete_message(msg uuid)
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
         image_height = null,
         audio_duration_ms = null,
         audio_peaks = null
   where id = msg;

  -- Chat photos and voice recordings are the message's own files; stickers stay in the pack.
  return case when old_type in ('image', 'voice') then old_path end;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice', 'voice', false, 5242880,
  array['audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/webm', 'audio/ogg', 'audio/mpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter policy "storage: members read conversation files" on storage.objects
  using (
    bucket_id in ('chat-images', 'memories', 'stickers', 'voice')
    and public.can_access_conversation_folder(name)
  );

alter policy "storage: members upload conversation files" on storage.objects
  with check (
    bucket_id in ('chat-images', 'memories', 'stickers', 'voice')
    and public.can_access_conversation_folder(name)
  );

alter policy "storage: owners delete conversation files" on storage.objects
  using (
    bucket_id in ('chat-images', 'memories', 'stickers', 'voice')
    and owner_id = (select auth.uid())::text
    and public.can_access_conversation_folder(name)
  );

-- ============================================================================
-- Shared lists
-- ============================================================================

create table public.lists (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 40),
  emoji           text check (char_length(emoji) <= 16),
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index lists_conversation_idx on public.lists (conversation_id, created_at);

create table public.list_items (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references public.lists (id) on delete cascade,
  -- Copied from the list by the trigger below, so reads can be checked cheaply.
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  text            text not null check (char_length(btrim(text)) between 1 and 200),
  done_at         timestamptz,
  done_by         uuid references public.profiles (id) on delete set null,
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index list_items_list_idx on public.list_items (list_id, created_at);

create function public.before_list_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.created_at := now();
    if (select count(*) from public.lists where conversation_id = new.conversation_id) >= 30 then
      raise exception 'TOO_MANY' using hint = 'You have 30 lists already.';
    end if;
  else
    new.conversation_id := old.conversation_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.title := btrim(new.title);
  return new;
end;
$$;

create trigger lists_before_write
  before insert or update on public.lists
  for each row execute function public.before_list_write();

create function public.before_list_item_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Take the conversation from the list itself; never trust the client for it.
    select l.conversation_id into new.conversation_id from public.lists l where l.id = new.list_id;
    if new.conversation_id is null then
      raise exception 'NOT_FOUND' using hint = 'That list is gone.';
    end if;
    if (select count(*) from public.list_items where list_id = new.list_id) >= 500 then
      raise exception 'TOO_MANY' using hint = 'This list is full (500 items).';
    end if;
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.done_at := null;
    new.done_by := null;
  else
    new.list_id := old.list_id;
    new.conversation_id := old.conversation_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- Ticking records who did it; unticking clears it.
    if new.done_at is not null and old.done_at is null then
      new.done_at := now();
      new.done_by := (select auth.uid());
    elsif new.done_at is null then
      new.done_by := null;
    else
      new.done_at := old.done_at;
      new.done_by := old.done_by;
    end if;
  end if;
  new.text := btrim(new.text);
  return new;
end;
$$;

create trigger list_items_before_write
  before insert or update on public.list_items
  for each row execute function public.before_list_item_write();

revoke execute on function public.before_list_write(), public.before_list_item_write() from public, anon, authenticated;

alter table public.lists enable row level security;
alter table public.list_items enable row level security;
revoke all on public.lists, public.list_items from anon, authenticated;
grant select, delete on public.lists, public.list_items to authenticated;
grant insert (id, conversation_id, title, emoji) on public.lists to authenticated;
grant update (title, emoji) on public.lists to authenticated;
grant insert (id, list_id, text) on public.list_items to authenticated;
grant update (text, done_at) on public.list_items to authenticated;

-- Shared: either of you can add, tick, rename or remove anything.
create policy "lists: members read" on public.lists for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy "lists: members add" on public.lists for insert to authenticated
  with check (public.is_conversation_member(conversation_id));
create policy "lists: members edit" on public.lists for update to authenticated
  using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));
create policy "lists: members delete" on public.lists for delete to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "list_items: members read" on public.list_items for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy "list_items: members add" on public.list_items for insert to authenticated
  with check (public.is_conversation_member(conversation_id));
create policy "list_items: members edit" on public.list_items for update to authenticated
  using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));
create policy "list_items: members delete" on public.list_items for delete to authenticated
  using (public.is_conversation_member(conversation_id));

-- Live on both phones.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lists, public.list_items;
  end if;
end;
$$;
