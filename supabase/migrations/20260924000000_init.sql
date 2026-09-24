-- ============================================================================
-- Private two-person messenger: schema, RLS, realtime, storage.
--
-- Security model
--   * Every table has RLS enabled. `anon` gets no privileges at all.
--   * Access is granted through membership in `conversation_members`.
--   * Membership rows are only created by the service-role setup script
--     (scripts/setup-users.mjs). No client can add itself to a conversation.
--   * Receipts and last_seen are written through narrow SECURITY DEFINER
--     functions so clients cannot edit message content or forge timestamps.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  username          text not null unique
                      check (username ~ '^[a-z0-9_]{2,24}$'),
  display_name      text not null
                      check (char_length(display_name) between 1 and 40),
  -- Object path inside the private `avatars` bucket (not a public URL).
  avatar_url        text check (char_length(avatar_url) <= 300),
  status_emoji      text check (char_length(status_emoji) <= 16),
  status_text       text check (char_length(status_text) <= 40),
  status_updated_at timestamptz,
  created_at        timestamptz not null default now(),
  last_seen         timestamptz
);

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content         text check (char_length(content) <= 4000),
  message_type    text not null default 'text' check (message_type in ('text', 'image')),
  -- Object path inside the private `chat-images` bucket (not a public URL).
  image_url       text check (char_length(image_url) <= 300),
  image_width     integer check (image_width between 1 and 10000),
  image_height    integer check (image_height between 1 and 10000),
  reply_to        uuid references public.messages (id) on delete set null,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  read_at         timestamptz,
  constraint messages_body_check check (
    (message_type = 'text' and image_url is null and content ~ '\S')
    or (message_type = 'image' and image_url is not null)
  )
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index messages_unread_idx
  on public.messages (conversation_id, sender_id)
  where read_at is null;
create index messages_sender_recent_idx
  on public.messages (sender_id, created_at desc);

-- Playful, manually configured relationship screen. Never auto-calculated.
create table public.bond (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  level           integer not null default 1 check (level between 1 and 99),
  progress        integer not null default 0 check (progress between 0 and 100),
  title           text not null default 'Partners in Crime'
                    check (char_length(title) between 1 and 60),
  together_since  date,
  updated_at      timestamptz not null default now()
);

create table public.memories (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 80),
  caption         text check (char_length(caption) <= 280),
  memory_date     date not null default current_date,
  -- Object path inside the private `memories` bucket.
  image_path      text not null check (char_length(image_path) <= 300),
  image_width     integer check (image_width between 1 and 10000),
  image_height    integer check (image_height between 1 and 10000),
  created_at      timestamptz not null default now()
);

create index memories_conversation_date_idx
  on public.memories (conversation_id, memory_date desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create function public.is_conversation_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = conv
      and m.user_id = (select auth.uid())
  );
$$;

create function public.shares_conversation_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members mine
    join public.conversation_members theirs
      on theirs.conversation_id = mine.conversation_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other
  );
$$;

-- True when the first path segment of a storage object name is a conversation
-- the current user belongs to. Tolerates malformed names instead of erroring.
create function public.can_access_conversation_folder(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := split_part(object_name, '/', 1);
begin
  if folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_conversation_member(folder::uuid);
end;
$$;

-- Realtime topic guard: only `conversation:<uuid>` topics of your own conversation.
create function public.can_access_realtime_topic(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if topic !~ '^conversation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_conversation_member(split_part(topic, ':', 2)::uuid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a profile for every new auth user. Username falls back to the
-- sanitised e-mail local part; the setup script sets the real values.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
begin
  base_name := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'user'),
    '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base_name) < 2 then
    base_name := 'user';
  end if;
  base_name := left(base_name, 16) || '_' || substr(replace(new.id::text, '-', ''), 1, 6);

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    base_name,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Player'), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A conversation holds at most two people.
create function public.enforce_two_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.conversation_members
      where conversation_id = new.conversation_id) >= 2 then
    raise exception 'A conversation can only have two members';
  end if;
  return new;
end;
$$;

create trigger conversation_members_limit
  before insert on public.conversation_members
  for each row execute function public.enforce_two_members();

-- Server-controlled fields, reply integrity, image path scope, rate limit.
create function public.before_message_insert()
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

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.before_message_insert();

create function public.before_memory_insert()
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
  return new;
end;
$$;

create trigger memories_before_insert
  before insert on public.memories
  for each row execute function public.before_memory_insert();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bond_touch_updated_at
  before update on public.bond
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create function public.mark_messages_delivered(conv uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not public.is_conversation_member(conv) then
    raise exception 'Not a member of this conversation';
  end if;
  update public.messages
     set delivered_at = now()
   where conversation_id = conv
     and sender_id <> auth.uid()
     and delivered_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create function public.mark_messages_read(conv uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not public.is_conversation_member(conv) then
    raise exception 'Not a member of this conversation';
  end if;
  update public.messages
     set read_at = now(),
         delivered_at = coalesce(delivered_at, now())
   where conversation_id = conv
     and sender_id <> auth.uid()
     and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- Written on disconnect / tab hide only. Not a heartbeat.
create function public.touch_last_seen()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set last_seen = now()
   where id = auth.uid()
  returning last_seen;
$$;

create function public.conversation_stats(conv uuid)
returns table (
  message_count bigint,
  image_count bigint,
  first_message_at timestamptz,
  favorite_emoji text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_member(conv) then
    raise exception 'Not a member of this conversation';
  end if;
  return query
  select
    (select count(*) from public.messages m where m.conversation_id = conv),
    (select count(*) from public.messages m
      where m.conversation_id = conv and m.message_type = 'image'),
    (select min(m.created_at) from public.messages m where m.conversation_id = conv),
    (select e.emoji
       from (
         select (regexp_matches(
                   m.content,
                   '[\U0001F300-\U0001FAFF☀-➿⭐⭕]',
                   'g'))[1] as emoji
         from public.messages m
         where m.conversation_id = conv and m.content is not null
       ) e
      group by e.emoji
      order by count(*) desc, e.emoji
      limit 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anon; narrow grants for authenticated.
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.conversations, public.conversation_members,
              public.messages, public.bond, public.memories
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, status_emoji, status_text, status_updated_at)
  on public.profiles to authenticated;

grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;

grant select on public.messages to authenticated;
grant insert (id, conversation_id, content, message_type, image_url,
              image_width, image_height, reply_to)
  on public.messages to authenticated;

grant select on public.bond to authenticated;
grant update (level, progress, title, together_since) on public.bond to authenticated;

grant select, delete on public.memories to authenticated;
grant insert (id, conversation_id, title, caption, memory_date, image_path,
              image_width, image_height)
  on public.memories to authenticated;

revoke execute on function
  public.is_conversation_member(uuid),
  public.shares_conversation_with(uuid),
  public.can_access_conversation_folder(text),
  public.can_access_realtime_topic(text),
  public.mark_messages_delivered(uuid),
  public.mark_messages_read(uuid),
  public.touch_last_seen(),
  public.conversation_stats(uuid)
  from public, anon;

grant execute on function
  public.is_conversation_member(uuid),
  public.shares_conversation_with(uuid),
  public.can_access_conversation_folder(text),
  public.can_access_realtime_topic(text),
  public.mark_messages_delivered(uuid),
  public.mark_messages_read(uuid),
  public.touch_last_seen(),
  public.conversation_stats(uuid)
  to authenticated;

-- Trigger functions are never called directly.
revoke execute on function
  public.handle_new_user(),
  public.enforce_two_members(),
  public.before_message_insert(),
  public.before_memory_insert()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.bond                 enable row level security;
alter table public.memories             enable row level security;

create policy "profiles: read self and partner"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_conversation_with(id));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "conversations: members read"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id));

create policy "conversation_members: members read"
  on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "messages: members read"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "messages: members send as themselves"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

create policy "bond: members read"
  on public.bond for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "bond: members update"
  on public.bond for update to authenticated
  using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));

create policy "memories: members read"
  on public.memories for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "memories: members create"
  on public.memories for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

create policy "memories: creator deletes"
  on public.memories for delete to authenticated
  using (
    created_by = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime
  add table public.messages, public.profiles, public.bond, public.memories;

-- Private broadcast (typing) + presence (online) on `conversation:<uuid>`.
create policy "realtime: members receive"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_realtime_topic((select realtime.topic()))
  );

create policy "realtime: members send"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_realtime_topic((select realtime.topic()))
  );

-- ---------------------------------------------------------------------------
-- Storage: private buckets with type and size limits.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chat-images', 'chat-images', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('memories', 'memories', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('avatars', 'avatars', false, 2097152,
    array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "storage: members read conversation files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('chat-images', 'memories')
    and public.can_access_conversation_folder(name)
  );

create policy "storage: members upload conversation files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('chat-images', 'memories')
    and public.can_access_conversation_folder(name)
  );

create policy "storage: owners delete conversation files"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('chat-images', 'memories')
    and owner_id = (select auth.uid())::text
    and public.can_access_conversation_folder(name)
  );

create policy "storage: read own and partner avatars"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      -- profiles is itself RLS-filtered to "self + partner" for the caller.
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
      )
    )
  );

create policy "storage: upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage: replace own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage: delete own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
