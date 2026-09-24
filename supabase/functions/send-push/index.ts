// send-push: called by the database (pg_net) after a message is inserted.
// Sends a Web Push notification to every device of the other member.
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
import { buildPayload, isGone, isUuid, pickSecretKey, safeEqual } from "./push.ts";

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

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "method not allowed" });
  if (!webhookSecret || !safeEqual(req.headers.get("x-push-secret") ?? "", webhookSecret)) {
    return reply(401, { error: "unauthorized" });
  }
  if (!vapidReady) return reply(500, { error: "VAPID secrets are not set" });

  const body = await req.json().catch(() => null);
  const messageId = body?.message_id;
  if (!isUuid(messageId)) return reply(400, { error: "message_id must be a uuid" });

  const { data: message, error: messageError } = await db
    .from("messages")
    .select("sender_id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError) return reply(500, { error: "lookup failed" });
  if (!message) return reply(404, { error: "message not found" });

  const [members, sender] = await Promise.all([
    db
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", message.conversation_id)
      .neq("user_id", message.sender_id),
    db.from("profiles").select("display_name").eq("id", message.sender_id).maybeSingle(),
  ]);
  if (members.error || sender.error) return reply(500, { error: "lookup failed" });

  const recipients = (members.data ?? []).map((m) => m.user_id);
  if (recipients.length === 0) return reply(200, { sent: 0, removed: 0 });

  const { data: subscriptions, error: subsError } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipients);
  if (subsError) return reply(500, { error: "lookup failed" });

  const payload = JSON.stringify(buildPayload(sender.data?.display_name));
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
            // Several unseen pushes collapse into one while the phone is offline.
            topic: "new-message",
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
