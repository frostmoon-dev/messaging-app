import type { BrowserSupabase } from "@/lib/supabase/client";
import type { MessageRow, ReplySnippet } from "@/types/app";

export const PAGE_SIZE = 50;
const COLUMNS =
  "id, conversation_id, sender_id, content, message_type, image_url, image_width, image_height, reply_to, created_at, delivered_at, read_at";

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
    .select("id, sender_id, content, message_type")
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
