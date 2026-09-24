"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useChat, useLiveTable } from "@/components/providers/ChatProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { LocateIcon, MapPinIcon } from "@/components/ui/icons";
import type { MapPoint } from "./LeafletMap";
import { createClient } from "@/lib/supabase/client";
import { directionsUrl, sendAlert } from "@/lib/alerts";
import { currentPosition, setSharingEnabled, sharingEnabled, stopSharing, uploadPosition } from "@/lib/location";
import { friendlyError } from "@/lib/errors";
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { AlertRow, LocationRow } from "@/types/app";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="skeleton size-full" aria-hidden="true" />,
});

const STALE_MS = 10 * 60_000;
const ago = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function relative(iso: string, now: number) {
  const mins = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return ago.format(mins, "minute");
  return ago.format(Math.round(mins / 60), "hour");
}

function subscribeSharing(onChange: () => void) {
  window.addEventListener("napyru:sharing", onChange);
  return () => window.removeEventListener("napyru:sharing", onChange);
}

export function MapScreen() {
  const { conversationId, me, partner } = useChat();
  const sharing = useSyncExternalStore(subscribeSharing, sharingEnabled, () => false);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [focusAlert, setFocusAlert] = useState<AlertRow | null>(null);
  const [busy, setBusy] = useState<"share" | "here" | "where" | "sos" | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmSos, setConfirmSos] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { data, error } = await createClient().from("locations").select("*").eq("conversation_id", conversationId);
    if (error) setNotice({ tone: "error", text: friendlyError(error, "load") });
    else setLocations(data);
  }, [conversationId]);

  // Refresh now and every minute (a person who stops sharing is a delete,
  // which live updates don't deliver), and keep "5 minutes ago" current.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load();
    const id = setInterval(() => {
      setNow(Date.now());
      void load();
    }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useLiveTable("locations", (change) => {
    const row = change.row as LocationRow;
    setNow(Date.now());
    setLocations((prev) => (change.type === "DELETE" ? prev.filter((l) => l.user_id !== row.user_id) : [...prev.filter((l) => l.user_id !== row.user_id), row]));
  });

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = locations.map((l) => {
      const mine = l.user_id === me.id;
      const who = mine ? me : partner;
      return {
        id: l.user_id,
        lat: l.lat,
        lng: l.lng,
        accuracy: l.accuracy,
        label: `${mine ? "You" : partner.display_name} · ${relative(l.updated_at, now)}`,
        initials: initials(who.display_name),
        tone: mine ? "me" : "partner",
        stale: now - new Date(l.updated_at).getTime() > STALE_MS,
      };
    });
    if (focusAlert?.lat != null && focusAlert.lng != null) {
      const sender = focusAlert.sender_id === me.id ? me : partner;
      list.push({
        id: focusAlert.id,
        lat: focusAlert.lat,
        lng: focusAlert.lng,
        accuracy: focusAlert.accuracy,
        label: `${focusAlert.kind === "sos" ? "SOS" : "Shared"} · ${sender.display_name} · ${relative(focusAlert.created_at, now)}`,
        initials: focusAlert.kind === "sos" ? "SOS" : initials(sender.display_name),
        tone: focusAlert.kind === "sos" ? "sos" : "partner",
        stale: false,
      });
    }
    return list;
  }, [locations, focusAlert, me, partner, now]);

  const partnerLocation = locations.find((l) => l.user_id === partner.id) ?? null;

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<string>) => {
    setBusy(kind);
    setNotice(null);
    try {
      setNotice({ tone: "ok", text: await task() });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error && !("code" in error) ? error.message : friendlyError(error, "save") });
    } finally {
      setBusy(null);
    }
  };

  const toggleSharing = () =>
    run("share", async () => {
      if (sharing) {
        await stopSharing();
        await load();
        return "Stopped. Your location is no longer shown.";
      }
      const pos = await currentPosition();
      await uploadPosition(conversationId, pos);
      setSharingEnabled(true);
      await load();
      return `Sharing with ${partner.display_name} while Napyru is open.`;
    });

  const sendHere = () =>
    run("here", async () => {
      const pos = await currentPosition();
      await sendAlert(conversationId, "here", pos);
      return `Sent. ${partner.display_name} can see where you are.`;
    });

  const askWhere = () =>
    run("where", async () => {
      await sendAlert(conversationId, "where");
      return `Asked ${partner.display_name} where they are.`;
    });

  const sendSos = () =>
    run("sos", async () => {
      setConfirmSos(false);
      // Send straight away; add the location if the phone gives it quickly.
      const pos = await Promise.race([currentPosition().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
      await sendAlert(conversationId, "sos", pos);
      return `SOS sent to ${partner.display_name}${pos ? " with your location" : ""}. Call them if you can.`;
    });

  // Deep links from notifications: /map?alert=<id> shows that spot,
  // /map?share=1 answers "Where are you?".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const alertId = params.get("alert");
    const share = params.get("share");
    if (alertId) {
      void createClient()
        .from("alerts")
        .select("*")
        .eq("id", alertId)
        .maybeSingle()
        .then(({ data }) => data && setFocusAlert(data));
    }
    if (alertId || share) window.history.replaceState(null, "", "/map");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time answer to "Where are you?"
    if (share) void sendHere();
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scroll-area flex h-full flex-col overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
        <PageHeader title="Map" description="Only the two of you can see this." />

        <div className="card relative h-[45dvh] min-h-72 overflow-hidden bg-panel">
          <LeafletMap points={points} focusId={focusAlert?.id ?? null} />
        </div>

        <p className="text-small text-muted-strong" aria-live="polite">
          {partnerLocation ? (
            <>
              <span className="font-semibold text-foreground">{partner.display_name}</span> · updated {relative(partnerLocation.updated_at, now)}
              {partnerLocation.accuracy ? ` · within ${Math.round(partnerLocation.accuracy)} m` : ""}
              {" · "}
              <a href={directionsUrl(partnerLocation.lat, partnerLocation.lng)} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline underline-offset-2">
                Directions
              </a>
            </>
          ) : (
            `${partner.display_name} isn't sharing their location right now.`
          )}
        </p>

        {notice && (
          <p className={cn("card bg-panel-strong p-3 text-small", notice.tone === "error" ? "text-danger" : "text-foreground")} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.text}
          </p>
        )}

        <section className="card bg-panel p-4" aria-labelledby="share-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="share-heading" className="font-semibold">
                Share my live location
              </h2>
              <p className="text-small text-muted-strong">
                Updates while Napyru is open. Phones don&apos;t let web apps share once they&apos;re closed.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sharing}
              aria-labelledby="share-heading"
              disabled={busy === "share"}
              onClick={() => void toggleSharing()}
              className={cn(
                "relative h-8 w-13 shrink-0 rounded-full border-2 transition-colors disabled:cursor-wait",
                sharing ? "border-accent bg-accent" : "border-field-border bg-panel-strong",
              )}
            >
              <span
                className={cn("absolute top-0.5 left-0.5 size-6 rounded-full transition-transform duration-150", sharing ? "translate-x-5 bg-accent-foreground" : "bg-muted-strong")}
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => void sendHere()} disabled={busy !== null}>
            <MapPinIcon size={18} /> {busy === "here" ? "Sending…" : "I'm here"}
          </Button>
          <Button variant="secondary" onClick={() => void askWhere()} disabled={busy !== null}>
            <LocateIcon size={18} /> {busy === "where" ? "Asking…" : "Where are you?"}
          </Button>
        </div>

        {/* SOS is big and separate from the everyday buttons, and asks once before sending. */}
        <button
          type="button"
          onClick={() => setConfirmSos(true)}
          disabled={busy === "sos"}
          className="pill mt-2 min-h-14 bg-[#d02a40] px-5 text-title font-extrabold text-white hover:bg-[#b02238]"
        >
          {busy === "sos" ? "Sending SOS…" : "SOS"}
        </button>
        <p className="-mt-2 text-small text-muted-strong">
          Sends an emergency alert with your location and plays an alarm on {partner.display_name}&apos;s phone if Napyru is open.
        </p>
      </div>

      {confirmSos && (
        <Dialog onClose={() => setConfirmSos(false)} label="Send SOS?" className="w-full sm:w-[420px]">
          <div className="bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h2 className="text-title font-bold">Send SOS to {partner.display_name}?</h2>
            <p className="mt-2 text-body text-muted-strong">They get an emergency alert with your location right away.</p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void sendSos()}
                autoFocus
                className="pill min-h-14 bg-[#d02a40] px-5 text-title font-extrabold text-white hover:bg-[#b02238]"
              >
                Send SOS now
              </button>
              <Button variant="ghost" onClick={() => setConfirmSos(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
