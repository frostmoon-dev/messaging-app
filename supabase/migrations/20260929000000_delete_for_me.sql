-- "Delete for me": hide any single message (yours or theirs) from your own
-- view only. The other person still has it. Enforced by the read policy, like
-- clear_chat, so hidden messages never reach your app or live updates.

create table public.message_hides (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.message_hides enable row level security;
revoke all on public.message_hides from anon, authenticated;
grant select on public.message_hides to authenticated;
grant insert (message_id) on public.message_hides to authenticated;

create policy "message_hides: own read"
  on public.message_hides for select to authenticated
  using (user_id = (select auth.uid()));

create policy "message_hides: hide what you can see"
  on public.message_hides for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
       where m.id = message_id
         and public.is_conversation_member(m.conversation_id)
    )
  );

-- True when the caller hid this message. Security definer so the read policy
-- below stays cheap and doesn't depend on message_hides' own policies.
create function public.is_hidden_for_me(msg uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.message_hides h
     where h.message_id = msg and h.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_hidden_for_me(uuid) from public, anon;
grant execute on function public.is_hidden_for_me(uuid) to authenticated;

drop policy "messages: members read" on public.messages;
create policy "messages: members read"
  on public.messages for select to authenticated
  using (
    public.is_conversation_member(conversation_id)
    and created_at > public.chat_visible_since(conversation_id)
    and not public.is_hidden_for_me(id)
  );
