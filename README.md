# Napyru

A private messenger for exactly two people. Calm, readable, and built around the conversation.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Supabase (Auth, Postgres + RLS, Realtime, Storage) · installable PWA.

## Features

- Realtime 1:1 chat: text, emoji, photos, replies (tap the quote to jump back), optimistic sending, retry on failure
- Receipts: ✓ sent · ✓✓ delivered · red ✓✓ read
- Typing indicator (Realtime broadcast) and online / last-seen (Realtime presence). No heartbeat rows
- Reconnects on its own and fills any gap in messages
- **Bond** screen (rank, title, progress, stats, all set by hand), **Memories** scrapbook, daily status with icons (Free to talk, Busy, Studying, At home, Out, Sleeping, Call me)
- Pop-up notifications through Web Push, even when the app is closed (asked only after you send something). They say who wrote, never what. Optional sounds (off by default)
- **Plans**: a shared calendar. Either of you adds, edits or deletes; reminders ("1 hour before", "1 day before"…) pop up on both phones
- **Map**: see each other while sharing is on (live while the app is open), send "I'm here", ask "Where are you?", get directions
- **SOS**: two taps send an emergency alert with your location. The other phone gets an urgent notification that stays on screen, and a full-screen alarm with a siren if Napyru is open
- Notifications read like "Rafie ♡ · Sent you a message" and never include message text
- Themes: **Ink** (default: soft black and white, rounded shapes with Persona 5 slanted buttons and titles), **Paper** (the light version of Ink), Automatic (Ink at night, Paper by day), **Phantom** (Persona 5 Royal: black, white, red), **Moon Cell** (Fate/EXTRA's digital moon: teal space, data green, cut corners, a faint coordinate grid, log-style day tags)
- Colours are checked by `npm run contrast` (WCAG 2.2) and follow eye-comfort rules; see "Colour" below. Mobile-first layout with keyboard-safe composer
- Game artwork from `public/assets` (Persona 3 Reload textures) turned into single-colour marks by `npm run ui-assets` and recoloured by the theme: status icons, talk bubble, arcana, sakura, rank-up, chevron, time-of-day banners

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

## Pop-up notifications (Web Push)

Without these steps, notifications only appear while the app is open in the background. With them, the server wakes the phone for every new message.

How it works: a new message → a database trigger (`pg_net`) → the `send-push` Edge Function → the phone's push service → the service worker shows "Ann sent you a message". Message text never leaves the database.

1. **Make the keys** (once): `npm run push:keys`. It prints a public and a private key.
2. **App setting:** add `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>` to `.env.local` and to Vercel (Settings → Environment Variables), then redeploy.
3. **Database:** `npx supabase db push` (or paste `supabase/migrations/20260925000000_web_push.sql` into the SQL editor).
4. **Function secrets:** make a long random value for the webhook secret (`openssl rand -hex 32`), then:
   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY=<public key> VAPID_PRIVATE_KEY=<private key> \
     VAPID_SUBJECT=mailto:you@example.com PUSH_WEBHOOK_SECRET=<random value>
   ```
5. **Deploy the function:** `npx supabase functions deploy send-push`. `supabase/config.toml` turns off the platform JWT check for this function, because the caller is the database, not a signed-in user; the function checks the webhook secret instead. If you deploy from the Dashboard, turn **Verify JWT** off for `send-push`.
6. **Tell the database where to call** (SQL editor, same random value as step 4):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
   select vault.create_secret('<random value>', 'push_webhook_secret');
   ```
   Until both secrets exist, the trigger does nothing and messaging works as before.
7. **On each phone:** open the installed app (iPhone: from the Home Screen icon) and turn **Notifications** on in Settings. If it was already on, opening the app registers the phone.
8. **Pop-up style is a phone setting.** iPhone: Settings → Notifications → Napyru → Banners, Banner Style "Persistent" if you want it to stay. Android: app notification settings → "Pop on screen" (the name varies by manufacturer).

**Test:** lock phone B, send a message from phone A. **Not arriving?** Check Edge Functions → `send-push` → Logs in the Dashboard, and the database side with `select status_code, content, created from net._http_response order by created desc limit 5;`. A 401 there means the two webhook secrets differ.

### Plans, Map and SOS (after the Web Push steps)

1. `npx supabase db push` applies `20260926000000_calendar_location.sql`. If it says `pg_cron` is missing, enable it in the Dashboard (Database → Extensions → **pg_cron**) and push again.
2. Redeploy the function so it knows reminders and alerts: `npx supabase functions deploy send-push`.
3. Check that the reminder job exists: `select jobname, schedule from cron.job;` shows `napyru-reminders` every minute.
4. On each phone, open **Map** once and allow location when asked.

**Limits, honestly:** a web app can only read location while it's open, so live sharing pauses when Napyru is closed ("I'm here" and SOS send the location at that moment). The SOS siren plays only when Napyru is open; when it's closed, the phone shows the urgent notification with its normal sound, and silent mode can mute it. SOS is not a replacement for calling emergency services.

## Colour

Each theme follows the same rules (tokens in `app/globals.css`, checked by `npm run contrast`):

- **No pure black page and no pure white text.** That pairing makes letters glow and blur ("halation"), worst for people with astigmatism. Dark themes use a dark grey page and off-white text; the light theme is warm paper.
- **Softer accents on dark backgrounds.** Ink's white accent is off-white, and the reds and greens are slightly desaturated so large areas don't vibrate.
- **60 / 30 / 10.** About 60% page, 30% panels and bubbles, 10% accent, which is kept for actions, selection and your own messages.
- **Contrast floors:** body text ≥ 7:1, secondary text and text on buttons ≥ 4.5:1, field borders ≥ 3:1.
- **Emergency is always red**, in every theme, including Moon Cell's green.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:security` | RLS / storage / realtime attack tests against the configured Supabase |
| `npm run test:e2e` | Two-browser Playwright run against `http://127.0.0.1:3000` (start the app first). Set `PLAYWRIGHT_CHROMIUM_PATH` to use a pre-installed Chromium. |
| `npm run setup:users` | Create/update the two accounts |
| `npm run push:keys` | Print a new VAPID key pair for Web Push |
| `npm run contrast` | Check WCAG contrast of every theme colour pair |
| `npm run ui-assets` | Rebuild the single-colour marks in `public/ui` from `public/assets` |
| `npm run db:types` | Regenerate `types/database.ts` from the local database |

## Notes and limits

- **Notifications** need the Web Push setup above to arrive while the app is closed. Without it they only fire while the app is open in the background. Signing out removes the phone from the push list.
- **iPhone:** notifications only work after "Add to Home Screen" (iOS 16.4+).
- **Enter to send:** on keyboards Enter sends and Shift+Enter adds a line. On touch screens Enter adds a line and the send button sends, like native messengers.
- Fonts: Atkinson Hyperlegible Next for all text and Atkinson Hyperlegible Mono for numbers (both SIL Open Font License, Braille Institute) via `next/font`, self-hosted at build time.
- Icons are generated by `npm run icons` (`scripts/generate-icons.mjs`) from the ink drawing in `scripts/brand/napyru-art.jpg`: a round crop with an ink ring, for the app icon, favicon, in-app mark and notification badge. The drawing is signed "mf"; keep credit to the artist.
- A start-up screen (`components/ui/Preloader.tsx`) shows the icon on paper white with "Loading" below. It is in the first HTML, so it shows before scripts load, and hides itself after 10 s if scripts fail.
