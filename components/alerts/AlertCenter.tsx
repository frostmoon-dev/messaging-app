"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useChat, useLiveTable } from "@/components/providers/ChatProvider";
import { Dialog } from "@/components/ui/Dialog";
import { CloseIcon, MapPinIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { directionsUrl, resolveAlert, sendAlert } from "@/lib/alerts";
import { currentPosition } from "@/lib/location";
import { startAlarm } from "@/lib/alarm";
import { playSound } from "@/lib/sound";
import { formatTime } from "@/lib/time";
import { devLog } from "@/lib/utils";
import type { AlertRow } from "@/types/app";

type Toast = { id: string; text: string; action?: "view" | "share"; alertId?: string };

/**
 * Always mounted inside the app. Shows an incoming SOS full screen with the
 * warning tone, and small notices for "I'm here", "Where are you?" and
 * "they saw your SOS".
 */
export function AlertCenter() {
  const { me, partner, conversationId } = useChat();
  const [sos, setSos] = useState<AlertRow | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const stopAlarm = useRef<(() => void) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const silence = useCallback(() => {
    stopAlarm.current?.();
    stopAlarm.current = null;
  }, []);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 10_000);
  }, []);

  useEffect(
    () => () => {
      silence();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [silence],
  );

  // Opened from an SOS notification, or the SOS arrived while the app was
  // closed: show the latest unhandled one (from the last hour) without the siren.
  useEffect(() => {
    let cancelled = false;
    void createClient()
      .from("alerts")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("kind", "sos")
      .neq("sender_id", me.id)
      .is("resolved_at", null)
      .gte("created_at", new Date(Date.now() - 3_600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data?.[0]) setSos(data[0]);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, me.id]);

  useLiveTable("alerts", (change) => {
    const alert = change.row as AlertRow;
    const fromPartner = alert.sender_id !== me.id;

    if (change.type === "INSERT" && fromPartner) {
      if (alert.kind === "sos") {
        setSos(alert);
        silence();
        stopAlarm.current = startAlarm();
      } else if (alert.kind === "here") {
        playSound("received");
        showToast({ id: alert.id, text: `${partner.display_name} ♡ shared where they are`, action: "view", alertId: alert.id });
      } else {
        playSound("received");
        showToast({ id: alert.id, text: `${partner.display_name} ♡ asks where you are`, action: "share" });
      }
    }

    if (change.type === "UPDATE" && alert.kind === "sos" && alert.resolved_at) {
      if (fromPartner) {
        setSos((current) => (current?.id === alert.id ? null : current));
        silence();
      } else if (alert.resolved_by && alert.resolved_by !== me.id) {
        showToast({ id: alert.id, text: `${partner.display_name} saw your SOS and is on it ♡` });
      }
    }
  });

  const shareNow = async () => {
    setToast(null);
    try {
      const pos = await currentPosition();
      await sendAlert(conversationId, "here", pos);
      showToast({ id: "sent", text: `Sent. ${partner.display_name} can see where you are.` });
    } catch (error) {
      showToast({ id: "err", text: error instanceof Error ? error.message : "Couldn't share your location." });
    }
  };

  const handle = async () => {
    if (!sos) return;
    silence();
    try {
      await resolveAlert(sos.id);
    } catch (error) {
      devLog("resolve failed", error);
    }
    setSos(null);
  };

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-md"
            role="status"
          >
            <div className="card flex items-center gap-3 border-l-4 border-accent bg-panel-strong p-3 shadow-lg">
              <MapPinIcon size={20} className="shrink-0 text-accent-text" />
              <p className="flex-1 text-small font-semibold">{toast.text}</p>
              {toast.action === "view" && (
                <Link
                  href={`/map?alert=${toast.alertId}`}
                  onClick={() => setToast(null)}
                  className="pill flex min-h-11 items-center bg-accent px-4 text-small font-bold text-accent-foreground hover:bg-accent-hover"
                >
                  View
                </Link>
              )}
              {toast.action === "share" && (
                <button
                  type="button"
                  onClick={() => void shareNow()}
                  className="pill min-h-11 bg-accent px-4 text-small font-bold text-accent-foreground hover:bg-accent-hover"
                >
                  Share
                </button>
              )}
              <button
                type="button"
                onClick={() => setToast(null)}
                className="flex size-11 items-center justify-center text-muted-strong hover:text-foreground"
                aria-label="Dismiss"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sos && (
        // Emergency uses a fixed red in every theme: it is the only colour
        // in the app, so it can't be missed.
        <Dialog onClose={silence} label={`SOS from ${partner.display_name}`} variant="fullscreen" className="w-full max-w-md px-4">
          <div role="alertdialog" aria-labelledby="sos-title" aria-describedby="sos-body" className="card bg-[#a8182c] p-6 text-white">
            <p className="text-small font-bold">Emergency</p>
            <h2 id="sos-title" className="mt-1 text-display leading-tight font-extrabold">
              SOS from {partner.display_name}
            </h2>
            <p id="sos-body" className="mt-3 text-body">
              Sent at <span className="font-mono font-bold">{formatTime(sos.created_at)}</span>.
              {sos.lat !== null ? " Their location is on the map." : " Their phone couldn't share a location."} Call them if you can.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {sos.lat !== null && sos.lng !== null && (
                <>
                  <Link
                    href={`/map?alert=${sos.id}`}
                    onClick={silence}
                    className="pill flex min-h-12 items-center justify-center gap-2 bg-white px-5 font-bold text-[#7a1020]"
                  >
                    <MapPinIcon size={18} /> See where on the map
                  </Link>
                  <a
                    href={directionsUrl(sos.lat, sos.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={silence}
                    className="pill flex min-h-12 items-center justify-center border-2 border-white px-5 font-bold"
                  >
                    Directions
                  </a>
                </>
              )}
              <button type="button" onClick={() => void handle()} className="pill min-h-12 bg-[#1b1a1e] px-5 font-bold text-white">
                I&apos;m on it
              </button>
              <button type="button" onClick={silence} className="min-h-11 text-small font-semibold underline underline-offset-2">
                Silence the alarm
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
