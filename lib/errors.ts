import { devLog } from "./utils";

export const MESSAGES = {
  send: "Couldn't send message. Try again.",
  upload: "Image upload failed. Try again.",
  rateLimited: "Too many messages at once. Wait a few seconds and try again.",
  load: "Couldn't load messages. Try again.",
  connection: "Connection lost. Reconnecting…",
  offline: "You're offline. Messages will send when you retry.",
  save: "Couldn't save. Try again.",
  signIn: "Wrong e-mail or password.",
  generic: "Something went wrong. Try again.",
  needsUpdate: "The database needs the latest update first (npx supabase db push).",
} as const;

type ErrorLike = { message?: string; code?: string; status?: number; statusCode?: string } | null | undefined;

/**
 * Maps a Supabase/network error to a short user-facing sentence.
 * The raw error is only logged in development.
 */
export function friendlyError(error: unknown, fallback: keyof typeof MESSAGES = "generic"): string {
  devLog(`error (${fallback})`, error);
  const e = error as ErrorLike;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return MESSAGES.offline;
  if (e?.code === "P0429" || e?.message?.includes("RATE_LIMITED")) return MESSAGES.rateLimited;
  // A feature whose migration isn't applied yet: the new message types fail the old
  // checks (23514), or the new table, column or function doesn't exist (42P01, 42703; PGRST205, PGRST202 from the API).
  if (
    (e?.code === "23514" && /messages_(body|message_type)_check/.test(e.message ?? "")) ||
    e?.code === "42P01" ||
    e?.code === "42703" ||
    e?.code === "PGRST202" ||
    e?.code === "PGRST205"
  ) {
    return MESSAGES.needsUpdate;
  }
  return MESSAGES[fallback];
}
