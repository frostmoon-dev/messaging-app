-- Send effects, like iMessage's (Slam, Loud, Gentle, Invisible ink, Shake,
-- Ripple, Bloom, Heartbeat). The app plays them when the message arrives.
-- Unknown or missing effects show the message as normal.

alter table public.messages
  add column effect text check (effect in ('slam', 'loud', 'gentle', 'ink', 'shake', 'ripple', 'bloom', 'heartbeat'));

grant insert (effect) on public.messages to authenticated;
