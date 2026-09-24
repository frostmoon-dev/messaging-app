import type { BrowserSupabase } from "@/lib/supabase/client";
import type { MessageRow, ReplySnippet } from "@/types/app";

export const PAGE_SIZE = 50;
// All columns: messages hold nothing large, and "*" keeps the chat loading if the
// app ships a moment before a migration that adds a column (e.g. deleted_at).
const COLUMNS = "*";

export async function fetchLatest(supabase: BrowserSupabase, conversationId: string, limit = PAGE_SIZE) {
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return { rows: (data ?? []).reverse(), hasMore: (data?.length ?? 0) === limit };
}

export async function fetchOlder(supabase: BrowserSupabase, conversationId: string, before: string) {
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .eq("conversation_id", conversationId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (error) throw error;
  return { rows: (data ?? []).reverse(), hasMore: (data?.length ?? 0) === PAGE_SIZE };
}

/** Messages newer than `after` (used to fill gaps after a reconnect). */
export async function fetchSince(supabase: BrowserSupabase, conversationId: string, after: string, limit = 500) {
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .eq("conversation_id", conversationId)
    .gt("created_at", after)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Everything from `from` (inclusive) up to `before` (exclusive). */
export async function fetchRange(
  supabase: BrowserSupabase,
  conversationId: string,
  from: string,
  before: string,
  limit = 1000,
) {
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .eq("conversation_id", conversationId)
    .gte("created_at", from)
    .lt("created_at", before)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMessage(supabase: BrowserSupabase, id: string) {
  const { data, error } = await supabase.from("messages").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSnippets(supabase: BrowserSupabase, ids: string[]): Promise<ReplySnippet[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export type NewMessage = Pick<
  MessageRow,
  "id" | "conversation_id" | "content" | "message_type" | "image_url" | "image_width" | "image_height" | "reply_to"
>;

export async function insertMessage(supabase: BrowserSupabase, message: NewMessage) {
  const { data, error } = await supabase.from("messages").insert(message).select(COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function markDelivered(supabase: BrowserSupabase, conversationId: string) {
  const { error } = await supabase.rpc("mark_messages_delivered", { conv: conversationId });
  if (error) throw error;
}

export async function markRead(supabase: BrowserSupabase, conversationId: string) {
  const { error } = await supabase.rpc("mark_messages_read", { conv: conversationId });
  if (error) throw error;
}

/** Deletes your own message for both of you. Returns the photo path to remove, if any. */
export async function deleteMessage(supabase: BrowserSupabase, id: string) {
  const { data, error } = await supabase.rpc("delete_message", { msg: id });
  if (error) throw error;
  return data;
}

/** Hides the whole history for you only. */
export async function clearChat(supabase: BrowserSupabase, conversationId: string) {
  const { error } = await supabase.rpc("clear_chat", { conv: conversationId });
  if (error) throw error;
}

/** Pinned messages, newest pin first (at most 5; the database keeps it that way). */
export async function fetchPinned(supabase: BrowserSupabase, conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .not("pinned_at", "is", null)
    .order("pinned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function pinMessage(supabase: BrowserSupabase, id: string, pinned: boolean) {
  const { error } = await supabase.rpc("pin_message", { msg: id, pinned });
  if (error) throw error;
}

/** Ids of the messages you starred (yours only). */
export async function fetchStarIds(supabase: BrowserSupabase) {
  const { data, error } = await supabase.from("message_stars").select("message_id");
  if (error) throw error;
  return (data ?? []).map((r) => r.message_id);
}

export async function setStar(supabase: BrowserSupabase, id: string, starred: boolean) {
  const { error } = starred
    ? await supabase.from("message_stars").insert({ message_id: id })
    : await supabase.from("message_stars").delete().eq("message_id", id);
  if (error) throw error;
}

/** Your starred messages with their content, newest star first. */
export async function fetchStarred(supabase: BrowserSupabase) {
  const { data, error } = await supabase
    .from("message_stars")
    .select("created_at, message:messages(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).flatMap((r) => (r.message && !r.message.deleted_at ? [r.message] : []));
}
