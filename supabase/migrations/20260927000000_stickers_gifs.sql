-- Stickers and GIFs in chat.
--
-- * "sticker" messages show an image without a bubble. The image is either
--   one of your own stickers (a path in the private `stickers` bucket) or a
--   GIPHY sticker (an https URL on GIPHY's media hosts).
-- * "gif" messages point at a GIPHY MP4 (https URL). Its title, if any, is
--   kept in `content` and used as the description for screen readers.
-- * `stickers` is the pack you share: either of you adds to it; the person
--   who added a sticker can remove it. Removing it from the pack keeps the
--   file, so stickers already sent still show.

-- ---------------------------------------------------------------------------
-- Messages: new types
-- ---------------------------------------------------------------------------

alter table public.messages drop constraint messages_message_type_check;
alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'sticker', 'gif'));

alter table public.messages drop constraint messages_body_check;
alter table public.messages
  add constraint messages_body_check check (
    (message_type = 'text' and image_url is null and content ~ '\S')
    or (message_type = 'image' and image_url is not null and image_url !~ '^https://')
    or (message_type = 'sticker' and image_url is not null
        and (image_url !~ '^https://' or image_url ~ '^https://(media[0-9]*|i)\.giphy\.com/'))
    or (message_type = 'gif' and image_url is not null
        and image_url ~ '^https://(media[0-9]*|i)\.giphy\.com/')
  );

-- Same checks as before; storage paths must still sit in this conversation's
-- folder, and only GIPHY URLs are allowed as links.
create or replace function public.before_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if auth.uid() is not null then
    new.sender_id := auth.uid();
  end if;
  new.created_at := now();
  new.delivered_at := null;
  new.read_at := null;

  if new.content is not null then
    new.content := btrim(new.content, E' \t\r\n');
    if new.content = '' then
      new.content := null;
    end if;
  end if;

  if new.reply_to is not null and not exists (
    select 1 from public.messages r
    where r.id = new.reply_to and r.conversation_id = new.conversation_id
  ) then
    raise exception 'Reply target is not in this conversation';
  end if;

  if new.image_url is not null
     and new.image_url !~ '^https://'
     and split_part(new.image_url, '/', 1) <> new.conversation_id::text then
    raise exception 'Image path does not belong to this conversation';
  end if;

  -- Rate limit: 30 messages per 10 seconds per sender.
  select count(*) into recent_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '10 seconds';
  if recent_count >= 30 then
    raise exception 'RATE_LIMITED' using errcode = 'P0429',
      hint = 'Too many messages. Slow down a little.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Your own sticker pack
-- ---------------------------------------------------------------------------

create table public.stickers (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Object path inside the private `stickers` bucket.
  image_path      text not null check (char_length(image_path) <= 300),
  image_width     integer check (image_width between 1 and 2000),
  image_height    integer check (image_height between 1 and 2000),
  created_at      timestamptz not null default now()
);

create index stickers_conversation_created_idx
  on public.stickers (conversation_id, created_at desc);

create function public.before_sticker_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  new.created_at := now();
  if split_part(new.image_path, '/', 1) <> new.conversation_id::text then
    raise exception 'Image path does not belong to this conversation';
  end if;
  if (select count(*) from public.stickers s where s.conversation_id = new.conversation_id) >= 300 then
    raise exception 'STICKER_LIMIT' using hint = 'Your pack is full (300). Remove some first.';
  end if;
  return new;
end;
$$;

create trigger stickers_before_insert
  before insert on public.stickers
  for each row execute function public.before_sticker_insert();

alter table public.stickers enable row level security;
revoke all on public.stickers from anon, authenticated;
grant select, delete on public.stickers to authenticated;
grant insert (id, conversation_id, image_path, image_width, image_height)
  on public.stickers to authenticated;

create policy "stickers: members read"
  on public.stickers for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "stickers: members add"
  on public.stickers for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

create policy "stickers: adder removes"
  on public.stickers for delete to authenticated
  using (
    created_by = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: a private `stickers` bucket with the same folder rules as chat
-- photos (first folder = conversation id, members only).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stickers', 'stickers', false, 2097152, array['image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter policy "storage: members read conversation files" on storage.objects
  using (
    bucket_id in ('chat-images', 'memories', 'stickers')
    and public.can_access_conversation_folder(name)
  );

alter policy "storage: members upload conversation files" on storage.objects
  with check (
    bucket_id in ('chat-images', 'memories', 'stickers')
    and public.can_access_conversation_folder(name)
  );

alter policy "storage: owners delete conversation files" on storage.objects
  using (
    bucket_id in ('chat-images', 'memories', 'stickers')
    and owner_id = (select auth.uid())::text
    and public.can_access_conversation_folder(name)
  );
