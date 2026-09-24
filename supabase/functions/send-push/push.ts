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

export type PushPayload = { title: string; body: string; url: string; tag: string };

/**
 * What the notification says. The message text is never included, so
 * nothing private shows on a lock screen or passes through the push service.
 */
export function buildPayload(senderName: string | null | undefined): PushPayload {
  const name = (senderName ?? "").trim().slice(0, 40) || "Someone";
  return { title: "NEW MESSAGE", body: `${name} sent you a message`, url: "/chat", tag: "new-message" };
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
