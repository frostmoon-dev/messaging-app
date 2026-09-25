# Napyru

A private messenger for exactly two people. Calm, readable, and built around the conversation.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Supabase (Auth, Postgres + RLS, Realtime, Storage) · installable PWA.

## Features

- Realtime 1:1 chat: text, emoji, photos, replies (tap the quote to jump back), optimistic sending, retry on failure
- Receipts: ✓ sent · ✓✓ delivered (their phone got it, even with the app closed) · ✓✓ read, and **“Seen 14:02”** under your newest message once it's read
- Typing indicator (Realtime broadcast), online (Realtime presence) and an honest **last seen**: a light heartbeat every 30 s while the app is on screen, plus a refresh when you come back to the app
- **Opens instantly:** the newest messages and photo links are kept on the device (wiped on sign-out), then refreshed from the server
- **Edit** your own text messages for 15 minutes (shows “edited” on both phones)
- **Reactions:** double-tap a message for a ❤️ (with a heart burst), or long-press for more reactions and any emoji
- **Photos like WhatsApp:** pick up to 10 at once (iPhone's own picker, with numbered ticks), check them in a tray above the message box (✕ to drop one, + to add more), add one caption (it goes with the first photo), and turn on **HD** to send full size (up to 4096 px) instead of the quicker 1920 px. They arrive in the order you picked. A web app can't show your camera roll inside its own panel; iPhone only allows its own picker
- **Message styles and effects:** tap **Aa** in the message box for Script, Big, Whisper or Typewriter, and an effect that plays when it arrives on both phones: Slam (the chat shakes too), Loud, Gentle, Invisible ink (tap to read; hidden on the lock screen too), Shake, Ripple, Bloom, or Heartbeat (a honey glow, and a buzz on Android). Replay it from the message's options
- **Looks like iMessage:** bubbles with a tail on the last one of a run, reactions on the bubble's top corner, “Delivered” / “Seen 14:02” under your newest message only, a centred “Today 10:43” after a break of an hour, and **swipe left** on the chat to see every message's time
- **Emoji panel** in the message box (the smiley): categories, search and recently used, like the iPhone keyboard
- **Haptics** (Settings → Alerts, on by default): a soft “lub-dub” heartbeat when you send, react or long-press. Android vibrates the pattern; iPhone gives light ticks during taps only
- Reconnects on its own and fills any gap in messages
- **Bond** screen (rank, title, progress, stats, all set by hand), **Memories** scrapbook (photos keep their own shape; crop them when adding), daily status with icons (Free to talk, Busy, Studying, At home, Out, Sleeping, Call me)
- Pop-up notifications through Web Push, even when the app is closed (asked only after you send something). They show the message text; turn **Show message text** off in Settings to show only “Sent you a message”. Photos, GIFs and stickers always say what they are (“Rafie sent a GIF.”). Several messages stack into one pop-up (“Rafie ♡ · 3 new messages”), and tapping it opens the chat with the reply box ready. Optional **quiet hours** (messages arrive without sound; SOS still rings) and **reaction pop-ups** (off by default). No pop-ups while you're in the chat. Optional sounds (off by default)
- **Thinking of you:** tap the heart in the chat header. Their phone gives a soft heartbeat and a pop-up, “Rafie is thinking of you.”
- **Anniversaries:** 1 month, 100 days, 6 months, every year, 500 days and every 1,000 days, counted from **Together since** on the Bond screen. Both phones get a pop-up at about 09:00, and the Bond screen shows the next one
- **On this day:** memories from this date in earlier years, at the top of Memories and as a 09:00 pop-up
- **Plans**: a shared calendar. Either of you adds, edits or deletes; reminders ("1 hour before", "1 day before"…) pop up on both phones
- **Map**: see each other while sharing is on (live while the app is open), send "I'm here", ask "Where are you?", get directions
- **SOS**: two taps send an emergency alert with your location. The other phone gets an urgent notification that stays on screen, and a full-screen alarm with a siren if Napyru is open
- Notifications read like "Rafie ♡ · See you at 8?" (or "Sent you a message" with previews off)
- Look taken from the app icon (an ink drawing in a circle): round portraits, pill buttons, evenly rounded cards with a hairline ink line, one brush stroke under page titles
- Themes: **Ink** (default: warm charcoal and off-white), **Paper** (the light version of Ink), Automatic (Ink at night, Paper by day). Colours carry meaning only: honey for the moments between you, green for "online", red for danger
- **Chat background** (Settings): plain, dots, grid, slash, or your own photo, cropped and dimmed. Saved on the device only; the photo is never uploaded
- Photo cropper (drag, pinch or slider to zoom) for memories, your avatar and the chat background
- Colours are checked by `npm run contrast` (WCAG 2.2) and follow eye-comfort rules; see "Colour" below. Mobile-first layout with keyboard-safe composer
- **Message actions** (long-press on phones, right-click or “…” on desktop): reply, copy, **pin** for both of you (up to 5, shown in a bar under the header), **favourite** (only you see them; the ★ at the top of the chat lists them), **delete for everyone** on your own messages (shows “Message deleted” on both phones and removes the photo file) and **delete for me** on any message (hides it on your side only)
- **Clear chat** (Settings → Chat history): hides the history up to now for you only; your partner keeps theirs
- **Stickers and GIFs** (the sticker button next to the photo button): your own shared sticker pack made from photos (cropped, transparent PNGs keep their transparency) or **imported from WhatsApp** (a chat export .zip — on iPhone send the stickers to yourself, then Export chat → Attach media — loose .webp stickers, or a .wastickers pack; animated stickers keep moving), plus GIF and sticker search from GIPHY. GIFs play as small looping videos you can pause, and wait for a tap when the phone asks for reduced motion
- Status icons come from `public/assets` (Persona 3 Reload textures), turned into single-colour marks by `npm run ui-assets`

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
| `GIPHY_API_KEY` | server (optional) | GIF and sticker search. Server-only. |
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

How it works: a new message → a database trigger (`pg_net`) → the `send-push` Edge Function → the phone's push service → the service worker shows it. The function skips anyone who has the chat open right now, and includes the message text only for people who allow it (Settings → Alerts → Show message text). The text then passes, encrypted, through the phone maker's push service.

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

### Stickers and GIFs

1. `npx supabase db push` applies `20260927000000_stickers_gifs.sql` (the sticker pack, a private `stickers` bucket, and the new message types).
2. Optional, for GIF search: create an app at [developers.giphy.com](https://developers.giphy.com), copy its API key, and set `GIPHY_API_KEY` where the app runs (Vercel → Settings → Environment Variables, then redeploy). It is server-only: never prefix it with `NEXT_PUBLIC_`. A free beta key allows 100 searches an hour; the app caches results for 10 minutes. Without a key, the GIF tabs say so and your own stickers still work.

Tenor isn't an option: Google shut its API down on 30 June 2026.

### Delete, clear, pin and favourites

`npx supabase db push` applies `20260928000000_delete_and_clear.sql`: `delete_message`, `clear_chat`, `pin_message`, the `message_stars` table, and a read policy that hides what you cleared. Until it runs, the chat works as before and those actions say the database needs the update. `20260929000000_delete_for_me.sql` adds `message_hides` for “Delete for me”.

### Edits, reactions, styles and smarter pop-ups

1. `npx supabase db push` applies `20260930000000_chat_upgrades.sql`: `heartbeat`, `edit_message`, `set_reaction`, the `message_reactions` table, and the `style`, `edited_at`, `chat_open_until` and `notification_preview` columns.
2. `npx supabase functions deploy send-push` so pop-ups show the text, skip you while you're in the chat, and mark messages delivered.

Until step 1 runs, the chat works as before; reactions, edits and styles don't save. Until step 2 runs, pop-ups work as before.

### Quiet hours, reaction pop-ups and SOS answers

1. `npx supabase db push` applies `20261001000000_push_upgrades.sql`: the `quiet_start`, `quiet_end`, `time_zone` and `notify_reactions` profile columns, a reaction trigger, `mark_alert_seen`, and the `napyru-sos-repeats` pg_cron job.
2. `npx supabase functions deploy send-push`, **after** step 1 (the function reads the new columns).

What it adds: quiet hours and reaction pop-ups in Settings → Alerts; the SOS sender gets “Rafie saw your SOS.” and “Rafie is on it.”; an SOS nobody has seen rings again after 2, 4 and 6 minutes. Message stacking and the reply box live in the service worker, so they arrive with the app itself.

**Limits, honestly:** a web app can only read location while it's open, so live sharing pauses when Napyru is closed ("I'm here" and SOS send the location at that moment). The SOS siren plays only when Napyru is open; when it's closed, the phone shows the urgent notification with its normal sound, and silent mode can mute it. SOS is not a replacement for calling emergency services.


### Thinking of you, anniversaries and On this day

1. `npx supabase db push` applies `20261002000000_couple_moments.sql`: the `love` alert kind, the `moments_sent` table, `memories_on_this_day`, and the hourly `napyru-moments` pg_cron job.
2. `npx supabase functions deploy send-push`, **after** step 1.

Moments go out on the first hourly run after 09:00 in your time zone (saved each time the app opens), once each. Set **Together since** in Bond → Edit for anniversaries.


### Send effects and avatar pop-ups

1. `npx supabase db push` applies `20261003000000_message_effects.sql` (the `effect` column).
2. `npx supabase functions deploy send-push`, **after** step 1: pop-ups name the effect ("I got the job (sent with Slam)"), keep invisible ink hidden, and show the sender's avatar (Android and desktop; iPhone always shows the app icon).

Until step 1 runs, messages with an effect are sent without it.

## Colour

Each theme follows the same rules (tokens in `app/globals.css`, checked by `npm run contrast`):

- **No pure black page and no pure white text.** That pairing makes letters glow and blur ("halation"), worst for people with astigmatism. Dark themes use a dark grey page and off-white text; the light theme is warm paper.
- **Warm neutrals.** Ink is warm charcoal and Paper is warm paper, not pure grey: it reads as ink on paper, like the icon, at the same contrast.
- **Softer accents on dark backgrounds.** Ink's white accent is off-white, and the reds, greens and honey are slightly desaturated so large areas don't vibrate.
- **60 / 30 / 10.** About 60% page, 30% panels and bubbles, 10% accent, which is kept for actions, selection and your own messages.
- **Contrast floors:** body text ≥ 7:1, secondary text and text on buttons ≥ 4.5:1, field borders ≥ 3:1.
- **Colour only means something.** Red is for emergencies and errors, green for "online", and honey (`--love`) for the moments between you two: typing…, Seen, read ticks, reactions, Bond progress and the send button. Everything else is ink. Honey, not rose, so a heart never looks like an alarm.

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
