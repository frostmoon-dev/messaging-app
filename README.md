# HEARTLINE

A private messenger for exactly two people. Calm, readable, and built around the conversation.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Supabase (Auth, Postgres + RLS, Realtime, Storage) · installable PWA.

## Features

- Realtime 1:1 chat: text, emoji, photos, replies (tap the quote to jump back), optimistic sending, retry on failure
- Receipts: ✓ sent · ✓✓ delivered · red ✓✓ read
- Typing indicator (Realtime broadcast) and online / last-seen (Realtime presence) — no heartbeat rows
- Reconnects on its own and fills any gap in messages
- **Bond** screen (level, title, progress, stats — all set by hand), **Memories** scrapbook, daily status
- Browser notifications when you're away (asked only after you send something), optional sounds (off by default)
- Automatic / Dark Hour / Daylight themes built on CSS variables (`app/globals.css`), checked by `npm run contrast`. Mobile-first layout with keyboard-safe composer
- Persona 3 Reload style HUD: calendar clock with moon phase and time-of-day banner, slanted menu cursor, and game marks (talk bubble, arcana, sakura, rank-up, chevron) built from `public/assets` by `npm run ui-assets`

## Security model

- Row Level Security on every table. `anon` has no privileges. Access = membership in `conversation_members`.
- Only the setup script (secret key, run on your machine) can create members. Public sign-up is off.
- Receipts and `last_seen` are written through narrow `SECURITY DEFINER` functions; clients can't edit messages or forge timestamps.
- Private Realtime channels (`conversation:<id>`) authorised by RLS on `realtime.messages`.
- Private Storage buckets with type + size limits; images are shown through short-lived signed URLs. Images are re-encoded in the browser (strips EXIF/GPS).
- Messages are rendered as plain text (no `dangerouslySetInnerHTML`). Content-Security-Policy, `X-Frame-Options: DENY`, etc. in `next.config.ts`.
- Rate limit: 30 messages / 10 s per sender (database trigger).
- `tests/security/rls.test.ts` attacks all of this with real sessions (outsider account, anon, spoofing, eavesdropping).

## Environment variables

Copy `.env.example` → `.env.local`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | app | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app | Publishable (public) key |
| `SUPABASE_SECRET_KEY` | **scripts/tests only** | Secret key. Never add it to your host / Vercel. |
| `SETUP_USER_{1,2}_{EMAIL,PASSWORD,USERNAME,DISPLAY_NAME}` | setup script | The two accounts |

## Run locally (Supabase CLI + Docker)

```bash
npm install
npx supabase start          # applies supabase/migrations
npx supabase status -o env  # copy API_URL, PUBLISHABLE_KEY, SECRET_KEY into .env.local
npm run setup:users         # creates both accounts + the conversation (safe to re-run)
npm run dev                 # http://127.0.0.1:3000
```

## Connect a hosted Supabase project

1. Create a project at supabase.com.
2. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`
   (or paste `supabase/migrations/20260924000000_init.sql` into the SQL editor).
3. **Authentication → Sign In / Providers:** turn **off** "Allow new users to sign up". Keep the Email provider **on** (turning it off also blocks sign-in).
4. **Realtime → Settings:** turn **off** "Allow public access" so only private (RLS-checked) channels work.
5. Fill `.env.local` with the project URL, publishable key and secret key, then `npm run setup:users`.
6. Deploy (e.g. Vercel) with only the two `NEXT_PUBLIC_*` variables. Add your site URL under Authentication → URL Configuration.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:security` | RLS / storage / realtime attack tests against the configured Supabase |
| `npm run test:e2e` | Two-browser Playwright run against `http://127.0.0.1:3000` (start the app first). Set `PLAYWRIGHT_CHROMIUM_PATH` to use a pre-installed Chromium. |
| `npm run setup:users` | Create/update the two accounts |
| `npm run contrast` | Check WCAG contrast of every theme colour pair |
| `npm run ui-assets` | Rebuild the single-colour marks in `public/ui` from `public/assets` |
| `npm run db:types` | Regenerate `types/database.ts` from the local database |

## Notes and limits

- **Notifications** are local notifications: they fire while the app is open or in a background tab. Getting pinged while the app is fully closed needs Web Push (VAPID keys + a server trigger), which is not included.
- **iPhone:** notifications only work after "Add to Home Screen" (iOS 16.4+).
- **Enter to send:** on keyboards Enter sends and Shift+Enter adds a line. On touch screens Enter adds a line and the send button sends, like native messengers.
- Fonts: Atkinson Hyperlegible Next for all text and Atkinson Hyperlegible Mono for numbers (both SIL Open Font License, Braille Institute) via `next/font`, self-hosted at build time.
- Icons are generated from one source by `npm run icons` (`scripts/generate-icons.mjs`).
