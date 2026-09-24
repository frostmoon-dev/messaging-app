import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BondRow, Session } from "@/types/app";

export type SessionResult =
  | { status: "signed-out" }
  | { status: "not-linked"; email: string | null }
  | { status: "ok"; session: Session; bond: BondRow | null };

/**
 * Loads the signed-in user, their conversation and partner. Uses getClaims(),
 * which verifies the JWT, rather than trusting the cookie.
 */
export const loadSession = cache(async (): Promise<SessionResult> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { status: "signed-out" };
  const email = (claimsData.claims.email as string | undefined) ?? null;

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return { status: "not-linked", email };

  const conversationId = membership.conversation_id;
  const [{ data: members }, { data: bond }] = await Promise.all([
    supabase.from("conversation_members").select("user_id").eq("conversation_id", conversationId),
    supabase.from("bond").select("*").eq("conversation_id", conversationId).maybeSingle(),
  ]);

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
  const me = profiles?.find((p) => p.id === userId);
  const partner = profiles?.find((p) => p.id !== userId);
  if (!me || !partner) return { status: "not-linked", email };

  return { status: "ok", session: { me, partner, conversationId }, bond: bond ?? null };
});
