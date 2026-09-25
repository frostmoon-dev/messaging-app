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

export type PushKind = "message" | "reaction" | "reminder" | "sos" | "sos_reply" | "here" | "where";

export type PushPayload = {
  kind: PushKind;
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Quiet hours: show it without sound or vibration. */
  silent?: boolean;
};

/** What the database asked for: exactly one thing. */
export type PushRequest =
  | { kind: "message"; id: string }
  | { kind: "event"; id: string }
  /** `repeat` > 0: an SOS nobody has seen yet, sent again. */
  | { kind: "alert"; id: string; repeat: number }
  | { kind: "sos_seen"; id: string }
  | { kind: "sos_handled"; id: string }
  /** `id` is the message that got the reaction. */
  | { kind: "reaction"; id: string; reactorId: string };

export function parseRequest(body: unknown): PushRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const repeat = typeof b.repeat === "number" && Number.isInteger(b.repeat) && b.repeat >= 1 && b.repeat <= 10 ? b.repeat : 0;
  const found = [
    isUuid(b.message_id) ? ({ kind: "message", id: b.message_id } as const) : null,
    isUuid(b.event_id) ? ({ kind: "event", id: b.event_id } as const) : null,
    isUuid(b.alert_id) ? ({ kind: "alert", id: b.alert_id, repeat } as const) : null,
    isUuid(b.sos_seen_id) ? ({ kind: "sos_seen", id: b.sos_seen_id } as const) : null,
    isUuid(b.sos_handled_id) ? ({ kind: "sos_handled", id: b.sos_handled_id } as const) : null,
    isUuid(b.reaction_message_id) && isUuid(b.reactor_id)
      ? ({ kind: "reaction", id: b.reaction_message_id, reactorId: b.reactor_id } as const)
      : null,
  ].filter((x) => x !== null);
  return found.length === 1 ? found[0] : null;
}

const HEART = "♡"; // ♡

function cleanName(name: string | null | undefined) {
  return (name ?? "").trim().slice(0, 40) || "Someone";
}

function oneLine(text: string | null | undefined, max: number) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * The single line a notification shows for a message. Photos, GIFs and
 * stickers always say what they are ("Rafie sent a GIF."). Written text (and
 * a photo's caption) shows only with `showText`, so nothing private appears
 * on a lock screen when the recipient turned previews off.
 */
export function messagePreview(
  message: { message_type: string; content: string | null },
  senderName: string | null | undefined,
  showText = true,
): string {
  const name = cleanName(senderName);
  const text = oneLine(message.content, 140);
  switch (message.message_type) {
    case "image":
      return showText && text ? `${name} sent a photo: ${text}` : `${name} sent a photo.`;
    case "sticker":
      return `${name} sent a sticker.`;
    case "gif":
      return `${name} sent a GIF.`;
    default:
      return (showText && text) || "Sent you a message";
  }
}

/**
 * What a new-message notification says. With `preview` it shows the
 * message (the recipient can turn that off in Settings, so nothing private
 * shows on their lock screen); without it just "Sent you a message".
 */
export function buildPayload(senderName: string | null | undefined, preview?: string | null): PushPayload {
  return {
    kind: "message",
    title: `${cleanName(senderName)} ${HEART}`,
    body: preview || "Sent you a message",
    url: "/chat",
    tag: "new-message",
  };
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

export function buildAlertPayload(
  alert: { id: string; kind: "sos" | "here" | "where" },
  senderName: string | null | undefined,
  repeat = 0,
): PushPayload {
  const name = cleanName(senderName);
  if (alert.kind === "sos") {
    return {
      kind: "sos",
      title: `SOS · ${name}`,
      body: repeat > 0 ? `Still no answer. ${name} needs help now. Tap to see where they are.` : `${name} needs help now. Tap to see where they are.`,
      url: `/map?alert=${alert.id}`,
      tag: `sos-${alert.id}`,
    };
  }
  if (alert.kind === "here") {
    return { kind: "here", title: `${name} ${HEART}`, body: "Shared where they are", url: `/map?alert=${alert.id}`, tag: "location" };
  }
  return { kind: "where", title: `${name} ${HEART}`, body: "Asks where you are. Tap to share.", url: "/map?share=1", tag: "location" };
}

/** Tells the SOS sender that the other person saw it, or is on the way. */
export function buildSosReplyPayload(alert: { id: string }, what: "seen" | "handled", name: string | null | undefined): PushPayload {
  const who = cleanName(name);
  return {
    kind: "sos_reply",
    title: `${who} ${HEART}`,
    body: what === "seen" ? `${who} saw your SOS.` : `${who} is on it.`,
    url: `/map?alert=${alert.id}`,
    // One pop-up per SOS: "is on it" replaces "saw your SOS".
    tag: `sos-reply-${alert.id}`,
  };
}

/** What your message is called in a reaction pop-up. */
function reactionTarget(message: { message_type: string; content: string | null }, showText: boolean) {
  switch (message.message_type) {
    case "image":
      return "your photo";
    case "sticker":
      return "your sticker";
    case "gif":
      return "your GIF";
    default: {
      const text = oneLine(message.content, 60);
      return showText && text ? `\u201c${text}\u201d` : "your message";
    }
  }
}

export function buildReactionPayload(
  message: { id: string; message_type: string; content: string | null },
  emoji: string,
  reactorName: string | null | undefined,
  showText: boolean,
): PushPayload {
  const name = cleanName(reactorName);
  return {
    kind: "reaction",
    title: `${name} ${HEART}`,
    body: `${name} reacted ${emoji} to ${reactionTarget(message, showText)}.`,
    url: `/chat?m=${message.id}`,
    // A changed reaction replaces the pop-up for that message.
    tag: `reaction-${message.id}`,
  };
}

/** Quiet hours as stored on a profile: minutes after local midnight. */
export type QuietHours = { quiet_start: number | null; quiet_end: number | null; time_zone: string | null };

/** Minutes after midnight in `timeZone` (UTC when unknown), or null for a bad zone name. */
export function minutesInZone(now: Date, timeZone: string | null | undefined): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return (hour % 24) * 60 + minute;
  } catch {
    return null;
  }
}

/** True during the person's quiet hours. Handles ranges over midnight (23:00–07:00). */
export function inQuietHours(profile: QuietHours, now = new Date()): boolean {
  const { quiet_start: start, quiet_end: end } = profile;
  if (start === null || end === null || start === end) return false;
  const t = minutesInZone(now, profile.time_zone);
  if (t === null) return false;
  return start < end ? t >= start && t < end : t >= start || t < end;
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
