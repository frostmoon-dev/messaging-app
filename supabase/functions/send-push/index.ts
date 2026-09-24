// send-push: called by the database (pg_net) for a new message, a due
// calendar reminder or an alert (SOS, "I'm here", "Where are you?").
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
  buildReminderPayload,
  isGone,
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

type Target = { conversationId: string; exclude: string | null; payload: PushPayload } | { status: number; error: string };

async function senderName(userId: string) {
  const { data } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name ?? null;
}

/** Finds who the notification is about and what it should say. */
async function resolve(request: PushRequest): Promise<Target> {
  if (request.kind === "message") {
    const { data, error } = await db.from("messages").select("sender_id, conversation_id").eq("id", request.id).maybeSingle();
    if (error) return { status: 500, error: "lookup failed" };
    if (!data) return { status: 404, error: "message not found" };
    return { conversationId: data.conversation_id, exclude: data.sender_id, payload: buildPayload(await senderName(data.sender_id)) };
  }
  if (request.kind === "event") {
    const { data, error } = await db.from("events").select("id, conversation_id, title, remind_minutes").eq("id", request.id).maybeSingle();
    if (error) return { status: 500, error: "lookup failed" };
    if (!data) return { status: 404, error: "event not found" };
    return { conversationId: data.conversation_id, exclude: null, payload: buildReminderPayload(data) };
  }
  const { data, error } = await db.from("alerts").select("id, conversation_id, sender_id, kind").eq("id", request.id).maybeSingle();
  if (error) return { status: 500, error: "lookup failed" };
  if (!data) return { status: 404, error: "alert not found" };
  return { conversationId: data.conversation_id, exclude: data.sender_id, payload: buildAlertPayload(data, await senderName(data.sender_id)) };
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
  if (!request) return reply(400, { error: "send exactly one of message_id, event_id, alert_id" });

  const target = await resolve(request);
  if ("error" in target) return reply(target.status, { error: target.error });

  // Messages and alerts go to the other person; reminders go to both of you.
  let membersQuery = db.from("conversation_members").select("user_id").eq("conversation_id", target.conversationId);
  if (target.exclude) membersQuery = membersQuery.neq("user_id", target.exclude);
  const members = await membersQuery;
  if (members.error) return reply(500, { error: "lookup failed" });

  const recipients = (members.data ?? []).map((m) => m.user_id);
  if (recipients.length === 0) return reply(200, { sent: 0, removed: 0 });

  const { data: subscriptions, error: subsError } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipients);
  if (subsError) return reply(500, { error: "lookup failed" });

  const payload = JSON.stringify(target.payload);
  const gone: string[] = [];
  let sent = 0;

  await Promise.all(
    (subscriptions ?? []).map(async (s) => {
      try {
        // web-push encrypts the payload and signs the VAPID header; the
        // request itself goes out with the runtime's own fetch.
        const request = webpush.generateRequestDetails(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          {
            TTL: 60 * 60 * 24,
            // High urgency lets a sleeping phone wake up and show it straight away.
            urgency: "high",
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
  return reply(200, { sent, removed: gone.length });
});
