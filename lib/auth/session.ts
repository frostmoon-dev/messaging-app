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

  // One round trip: every membership you can see (yours and your partner's,
  // thanks to RLS) with its profile, and the bond, fetched side by side.
  // They used to be three queries in a row.
  const [{ data: rows }, { data: bonds }] = await Promise.all([
    supabase
      .from("conversation_members")
      .select("conversation_id, user_id, joined_at, profiles(*)")
      .order("joined_at", { ascending: true }),
    supabase.from("bond").select("*"),
  ]);

  const mine = (rows ?? []).find((r) => r.user_id === userId);
  if (!mine) return { status: "not-linked", email };
  const conversationId = mine.conversation_id;
  const inConversation = (rows ?? []).filter((r) => r.conversation_id === conversationId);
  const profileOf = (r: (typeof inConversation)[number]) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) ?? null;
  const me = profileOf(mine);
  const partnerRow = inConversation.find((r) => r.user_id !== userId);
  const partner = partnerRow ? profileOf(partnerRow) : null;
  if (!me || !partner) return { status: "not-linked", email };
  const bond = (bonds ?? []).find((b) => b.conversation_id === conversationId);

  return { status: "ok", session: { me, partner, conversationId }, bond: bond ?? null };
});
