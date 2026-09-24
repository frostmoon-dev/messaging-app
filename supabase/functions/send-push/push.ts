// Pure helpers for the send-push function. No imports, no Deno globals, so
// the app's unit tests can import this file too.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Compares two strings in time that does not depend on where they differ. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export type PushKind = "message" | "reminder" | "sos" | "here" | "where";

export type PushPayload = { kind: PushKind; title: string; body: string; url: string; tag: string };

/** What the database asked for: exactly one id. */
export type PushRequest = { kind: "message"; id: string } | { kind: "event"; id: string } | { kind: "alert"; id: string };

export function parseRequest(body: unknown): PushRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const found = [
    isUuid(b.message_id) ? ({ kind: "message", id: b.message_id } as const) : null,
    isUuid(b.event_id) ? ({ kind: "event", id: b.event_id } as const) : null,
    isUuid(b.alert_id) ? ({ kind: "alert", id: b.alert_id } as const) : null,
  ].filter((x) => x !== null);
  return found.length === 1 ? found[0] : null;
}

const HEART = "♡"; // ♡

function cleanName(name: string | null | undefined) {
  return (name ?? "").trim().slice(0, 40) || "Someone";
}

/**
 * What a new-message notification says. The message text is never
 * included, so nothing private shows on a lock screen or passes through
 * the push service.
 */
export function buildPayload(senderName: string | null | undefined): PushPayload {
  return { kind: "message", title: `${cleanName(senderName)} ${HEART}`, body: "Sent you a message", url: "/chat", tag: "new-message" };
}

/** Reminders are relative ("in 1 hour"), so no time zone is needed on the server. */
export function buildReminderPayload(event: { id: string; title: string; remind_minutes: number | null }): PushPayload {
  const title = event.title.trim().slice(0, 80) || "Plan";
  const when: Record<number, string> = {
    0: "is starting now",
    10: "starts in 10 minutes",
    30: "starts in 30 minutes",
    60: "starts in 1 hour",
    120: "starts in 2 hours",
    1440: "is tomorrow",
  };
  return {
    kind: "reminder",
    title: `${HEART} Reminder`,
    body: `${title} ${when[event.remind_minutes ?? 0] ?? "is coming up"}`,
    url: `/plans?event=${event.id}`,
    tag: `event-${event.id}`,
  };
}

export function buildAlertPayload(alert: { id: string; kind: "sos" | "here" | "where" }, senderName: string | null | undefined): PushPayload {
  const name = cleanName(senderName);
  if (alert.kind === "sos") {
    return {
      kind: "sos",
      title: `SOS · ${name}`,
      body: `${name} needs help now. Tap to see where they are.`,
      url: `/map?alert=${alert.id}`,
      tag: `sos-${alert.id}`,
    };
  }
  if (alert.kind === "here") {
    return { kind: "here", title: `${name} ${HEART}`, body: "Shared where they are", url: `/map?alert=${alert.id}`, tag: "location" };
  }
  return { kind: "where", title: `${name} ${HEART}`, body: "Asks where you are. Tap to share.", url: "/map?share=1", tag: "location" };
}

/** The push service says this address no longer exists: delete it. */
export function isGone(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/** Reads the service key: the new SUPABASE_SECRET_KEYS JSON first, then the legacy key. */
export function pickSecretKey(secretKeysJson: string | undefined, legacyServiceRoleKey: string | undefined): string {
  try {
    const keys = JSON.parse(secretKeysJson || "{}") as Record<string, unknown>;
    if (typeof keys.default === "string" && keys.default) return keys.default;
  } catch {
    // Fall through to the legacy key.
  }
  return legacyServiceRoleKey ?? "";
}
