// send-push: called by the database (pg_net) for a new message, a reaction,
// a due calendar reminder, an alert (SOS, "I'm here", "Where are you?"), an
// SOS repeat, or an answer to an SOS ("saw your SOS", "is on it").
// Sends a Web Push notification to the right people's devices.
//
// Secrets (supabase secrets set ...):
//   PUSH_WEBHOOK_SECRET  shared with the database (Vault: push_webhook_secret)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
// SUPABASE_URL and the secret key are provided by the platform.
//
// Deployed with verify_jwt = false (supabase/config.toml): the caller is the
// database, not a signed-in user, so it proves itself with x-push-secret.

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import {
  buildAlertPayload,
  buildPayload,
  buildReactionPayload,
  buildReminderPayload,
  buildSosReplyPayload,
  inQuietHours,
  isGone,
  messagePreview,
  parseRequest,
  pickSecretKey,
  safeEqual,
  type PushPayload,
  type PushRequest,
} from "./push.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

const webhookSecret = env("PUSH_WEBHOOK_SECRET");
const vapid = {
  publicKey: env("VAPID_PUBLIC_KEY"),
  privateKey: env("VAPID_PRIVATE_KEY"),
  subject: env("VAPID_SUBJECT"),
};
const vapidReady = Boolean(vapid.publicKey && vapid.privateKey && vapid.subject);
if (vapidReady) webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

const db = createClient(env("SUPABASE_URL"), pickSecretKey(env("SUPABASE_SECRET_KEYS"), env("SUPABASE_SERVICE_ROLE_KEY")), {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Target =
  | {
      conversationId: string;
      /** Everyone in the chat except this person… */
      exclude: string | null;
      /** …or only this person. */
      only?: string;
      payload: PushPayload;
      /** Messages and reactions: the wording for people who allow a preview. */
      preview?: string;
    }
  | { status: number; error: string }
  | { skipped: string };

async function senderName(userId: string) {
  const { data } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name ?? null;
}

/** Finds who the notification is for and what it should say. */
async function resolve(request: PushRequest): Promise<Target> {
  if (request.kind === "message") {
    const { data, error } = await db
      .from("messages")
      .select("sender_id, conversation_id, content, message_type")
      .eq("id", request.id)
      .maybeSingle();
    if (error) return { status: 500, error: "lookup failed" };
    if (!data) return { status: 404, error: "message not found" };
    const name = await senderName(data.sender_id);
    return {
      conversationId: data.conversation_id,
      exclude: data.sender_id,
      payload: buildPayload(name, messagePreview(data, name, false)),
      preview: messagePreview(data, name, true),
    };
  }
  if (request.kind === "reaction") {
    const [message, reaction] = await Promise.all([
      db.from("messages").select("id, sender_id, conversation_id, content, message_type, deleted_at").eq("id", request.id).maybeSingle(),
      db.from("message_reactions").select("emoji").eq("message_id", request.id).eq("user_id", request.reactorId).maybeSingle(),
    ]);
    if (message.error || reaction.error) return { status: 500, error: "lookup failed" };
    if (!message.data || message.data.deleted_at) return { skipped: "message gone" };
    // Taken back (or changed and taken back) before we got here.
    if (!reaction.data?.emoji) return { skipped: "reaction removed" };
    if (message.data.sender_id === request.reactorId) return { skipped: "own message" };
    const name = await senderName(request.reactorId);
    return {
      conversationId: message.data.conversation_id,
      exclude: null,
      only: message.data.sender_id,
      payload: buildReactionPayload(message.data, reaction.data.emoji, name, false),
      preview: buildReactionPayload(message.data, reaction.data.emoji, name, true).body,
    };
  }
  if (request.kind === "event") {
    const { data, error } = await db.from("events").select("id, conversation_id, title, remind_minutes").eq("id", request.id).maybeSingle();
    if (error) return { status: 500, error: "lookup failed" };
    if (!data) return { status: 404, error: "event not found" };
    return { conversationId: data.conversation_id, exclude: null, payload: buildReminderPayload(data) };
  }
  const { data, error } = await db
    .from("alerts")
    .select("id, conversation_id, sender_id, kind, seen_at, seen_by, resolved_at, resolved_by")
    .eq("id", request.id)
    .maybeSingle();
  if (error) return { status: 500, error: "lookup failed" };
  if (!data) return { status: 404, error: "alert not found" };
  if (request.kind === "alert") {
    // A repeat that lost the race with "seen" or "I'm on it".
    if (request.repeat > 0 && (data.seen_at || data.resolved_at)) return { skipped: "already seen" };
    return {
      conversationId: data.conversation_id,
      exclude: data.sender_id,
      payload: buildAlertPayload(data, await senderName(data.sender_id), request.repeat),
    };
  }
  // SOS answers go back to the person who sent the SOS.
  const answeredBy = request.kind === "sos_seen" ? data.seen_by : data.resolved_by;
  if (!answeredBy || answeredBy === data.sender_id) return { skipped: "no answer" };
  return {
    conversationId: data.conversation_id,
    exclude: null,
    only: data.sender_id,
    payload: buildSosReplyPayload(data, request.kind === "sos_seen" ? "seen" : "handled", await senderName(answeredBy)),
  };
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "method not allowed" });
  if (!webhookSecret || !safeEqual(req.headers.get("x-push-secret") ?? "", webhookSecret)) {
    return reply(401, { error: "unauthorized" });
  }
  if (!vapidReady) return reply(500, { error: "VAPID secrets are not set" });

  const request = parseRequest(await req.json().catch(() => null));
  if (!request) {
    return reply(400, { error: "send exactly one of message_id, event_id, alert_id, sos_seen_id, sos_handled_id, reaction_message_id" });
  }

  const target = await resolve(request);
  if ("error" in target) return reply(target.status, { error: target.error });
  if ("skipped" in target) return reply(200, { sent: 0, removed: 0, skipped: target.skipped });

  // Messages and alerts go to the other person; reminders go to both of you;
  // reactions and SOS answers go to one person.
  let membersQuery = db.from("conversation_members").select("user_id").eq("conversation_id", target.conversationId);
  if (target.exclude) membersQuery = membersQuery.neq("user_id", target.exclude);
  if (target.only) membersQuery = membersQuery.eq("user_id", target.only);
  const members = await membersQuery;
  if (members.error) return reply(500, { error: "lookup failed" });

  let recipients = (members.data ?? []).map((m) => m.user_id);

  // Messages and reactions: skip anyone who is looking at the chat right now
  // (the app reports that every 30 s), use each person's preview setting, and
  // arrive silently during their quiet hours. Reaction pop-ups are opt-in.
  const chatty = request.kind === "message" || request.kind === "reaction";
  const showPreview = new Set<string>();
  const quiet = new Set<string>();
  if (chatty && recipients.length > 0) {
    const { data: prefs, error: prefsError } = await db
      .from("profiles")
      .select("id, chat_open_until, notification_preview, notify_reactions, quiet_start, quiet_end, time_zone")
      .in("id", recipients);
    if (prefsError || !prefs) {
      // Older database without these columns: messages go to everyone with
      // no preview; reactions (which need the newer database) go nowhere.
      console.error("preferences lookup failed", prefsError);
      if (request.kind === "reaction") recipients = [];
    } else {
      const now = new Date();
      const skip = new Set(
        prefs
          .filter(
            (p) =>
              (p.chat_open_until && Date.parse(p.chat_open_until) > now.getTime()) ||
              (request.kind === "reaction" && p.notify_reactions !== true),
          )
          .map((p) => p.id),
      );
      recipients = recipients.filter((id) => !skip.has(id));
      for (const p of prefs) {
        if (p.notification_preview !== false) showPreview.add(p.id);
        if (inQuietHours(p, now)) quiet.add(p.id);
      }
    }
  }
  if (recipients.length === 0) return reply(200, { sent: 0, removed: 0, skipped: "no one to notify" });

  const { data: subscriptions, error: subsError } = await db
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", recipients);
  if (subsError) return reply(500, { error: "lookup failed" });

  const payloadFor = (userId: string): PushPayload => ({
    ...target.payload,
    ...(target.preview && showPreview.has(userId) ? { body: target.preview } : {}),
    ...(quiet.has(userId) ? { silent: true } : {}),
  });
  const gone: string[] = [];
  let sent = 0;

  await Promise.all(
    (subscriptions ?? []).map(async (s) => {
      try {
        // web-push encrypts the payload and signs the VAPID header; the
        // request itself goes out with the runtime's own fetch.
        const request = webpush.generateRequestDetails(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payloadFor(s.user_id)),
          {
            TTL: 60 * 60 * 24,
            // High urgency lets a sleeping phone wake up and show it straight
            // away. During quiet hours it can wait for the phone's next wake.
            urgency: quiet.has(s.user_id) ? "normal" : "high",
            // Unseen pushes with the same topic collapse into one while the
            // phone is offline. Every SOS keeps its own topic.
            topic: target.payload.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "-"),
          },
        );
        const res = await fetch(request.endpoint, {
          method: request.method,
          headers: request.headers as Record<string, string>,
          body: request.body ? new Uint8Array(request.body) : undefined,
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) sent++;
        else if (isGone(res.status)) gone.push(s.endpoint);
        else console.error("push rejected", res.status, await res.text().catch(() => ""));
      } catch (error) {
        console.error("push failed", error);
      }
    }),
  );

  if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);
  // A push service accepted it for their phone: that's "delivered" (two ticks),
  // even if the app stays closed. Receipts only move forward.
  if (request.kind === "message" && sent > 0) {
    const { error } = await db
      .from("messages")
      .update({ delivered_at: new Date().toISOString() })
      .eq("id", request.id)
      .is("delivered_at", null);
    if (error) console.error("delivered mark failed", error);
  }
  return reply(200, { sent, removed: gone.length });
});
