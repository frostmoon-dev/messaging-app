import { createClient } from "@/lib/supabase/client";
import type { Position } from "./location";
import type { AlertRow } from "@/types/app";

export type AlertKind = "sos" | "here" | "where" | "love";

/** Sends an alert to the other person. The database notifies them by push. */
export async function sendAlert(conversationId: string, kind: AlertKind, pos?: Position | null): Promise<AlertRow> {
  const { data, error } = await createClient()
    .from("alerts")
    .insert({
      conversation_id: conversationId,
      kind,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      accuracy: pos ? Math.round(pos.accuracy) : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function resolveAlert(id: string) {
  const { error } = await createClient().rpc("resolve_alert", { alert: id });
  if (error) throw error;
}

/** Tells the sender their SOS is on your screen. Only the first call counts. */
export async function markAlertSeen(id: string) {
  const { error } = await createClient().rpc("mark_alert_seen", { alert: id });
  if (error) throw error;
}

/** A link that opens turn-by-turn directions in the phone's map app. */
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
