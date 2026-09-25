"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useChat, useLiveTable } from "@/components/providers/ChatProvider";
import { Dialog } from "@/components/ui/Dialog";
import { CloseIcon, HeartIcon, MapPinIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { directionsUrl, markAlertSeen, resolveAlert, sendAlert } from "@/lib/alerts";
import { currentPosition } from "@/lib/location";
import { primeAlarm, startAlarm } from "@/lib/alarm";
import { playSound } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { formatTime } from "@/lib/time";
import { devLog } from "@/lib/utils";
import type { AlertRow } from "@/types/app";

type Toast = { id: string; text: string; action?: "view" | "share"; alertId?: string; icon?: "heart" };

/**
 * Always mounted inside the app. Shows an incoming SOS full screen with the
 * warning tone, and small notices for "I'm here", "Where are you?" and
 * "they saw your SOS".
 */
export function AlertCenter() {
  const { me, partner, conversationId } = useChat();
  const router = useRouter();
  const [sos, setSos] = useState<AlertRow | null>(null);
  // Full screen, or folded into a red bar at the top (after "See where" or closing).
  const [sosOpen, setSosOpen] = useState(true);
  const [alarmOn, setAlarmOn] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [answerFailed, setAnswerFailed] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const stopAlarm = useRef<(() => void) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // SOS ids already reported as seen (theirs) or toasted as seen (yours).
  const seenSent = useRef(new Set<string>());
  const seenToasted = useRef(new Set<string>());

  const silence = useCallback(() => {
    stopAlarm.current?.();
    stopAlarm.current = null;
    setAlarmOn(false);
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

  // iPhone only allows sound after a tap: unlock the alarm on your first
  // tap, so an SOS that arrives later can sound by itself.
  useEffect(() => {
    const events = ["touchend", "click", "keydown"] as const;
    const unlock = () => {
      void primeAlarm().then((ok) => {
        if (ok) events.forEach((name) => window.removeEventListener(name, unlock, true));
      });
    };
    events.forEach((name) => window.addEventListener(name, unlock, true));
    return () => events.forEach((name) => window.removeEventListener(name, unlock, true));
  }, []);

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
        if (!cancelled && data?.[0]) {
          setSos(data[0]);
          setSosOpen(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, me.id]);

  // Their SOS is on your screen: tell them, once. Waits until the app is
  // actually visible, so a phone in a pocket doesn't count as "seen".
  const sosId = sos?.id ?? null;
  useEffect(() => {
    if (!sosId) return;
    const report = () => {
      if (document.visibilityState !== "visible" || seenSent.current.has(sosId)) return;
      seenSent.current.add(sosId);
      markAlertSeen(sosId).catch((error) => {
        seenSent.current.delete(sosId);
        devLog("mark seen failed", error);
      });
    };
    report();
    document.addEventListener("visibilitychange", report);
    return () => document.removeEventListener("visibilitychange", report);
  }, [sosId]);

  useLiveTable("alerts", (change) => {
    const alert = change.row as AlertRow;
    const fromPartner = alert.sender_id !== me.id;

    if (change.type === "INSERT" && fromPartner) {
      if (alert.kind === "sos") {
        setSos(alert);
        setSosOpen(true);
        silence();
        stopAlarm.current = startAlarm();
        setAlarmOn(true);
      } else if (alert.kind === "love") {
        haptic("heart");
        showToast({ id: alert.id, text: `${partner.display_name} is thinking of you ♡`, icon: "heart" });
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

    if (
      change.type === "UPDATE" &&
      alert.kind === "sos" &&
      !fromPartner &&
      !alert.resolved_at &&
      alert.seen_at &&
      !seenToasted.current.has(alert.id)
    ) {
      seenToasted.current.add(alert.id);
      showToast({ id: `${alert.id}-seen`, text: `${partner.display_name} saw your SOS ♡` });
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
    setAnswering(true);
    setAnswerFailed(false);
    try {
      await resolveAlert(sos.id);
    } catch (error) {
      // Keep the SOS on screen: they must know their answer didn't reach the other phone.
      devLog("resolve failed", error);
      setAnswering(false);
      setAnswerFailed(true);
      return;
    }
    setAnswering(false);
    setSos(null);
  };

  // Close the full screen and show the spot. The SOS stays unanswered (red bar)
  // until "I'm on it", so the other person isn't told you're coming by accident.
  const showOnMap = () => {
    if (!sos) return;
    silence();
    setSosOpen(false);
    router.push(`/map?alert=${sos.id}`);
    window.dispatchEvent(new CustomEvent("napyru:focus-alert", { detail: sos }));
  };

  const fold = () => {
    silence();
    setSosOpen(false);
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
            <div className="card flex items-center gap-3 border-l-4 border-accent bg-panel-strong p-3 shadow-[var(--shadow-float)]">
              {toast.icon === "heart" ? (
                <HeartIcon size={20} fill="currentColor" className="shrink-0 text-love" />
              ) : (
                <MapPinIcon size={20} className="shrink-0 text-accent-text" />
              )}
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

      {sos && !sosOpen && (
        // Folded SOS: stays at the top of every screen until it's answered.
        <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-md" role="alert">
          <div className="flex items-center gap-2 rounded-full bg-[#a8182c] py-1.5 pr-1.5 pl-4 text-white shadow-[var(--shadow-float)]">
            <button type="button" onClick={() => setSosOpen(true)} className="min-h-11 flex-1 text-left text-small font-bold">
              SOS from {partner.display_name} · {formatTime(sos.created_at)}
            </button>
            <button
              type="button"
              onClick={() => void handle()}
              disabled={answering}
              className="pill min-h-11 bg-white px-4 text-small font-bold text-[#7a1020] disabled:opacity-80"
            >
              {answering ? "Sending…" : answerFailed ? "Try again" : "I'm on it"}
            </button>
          </div>
        </div>
      )}

      {sos && sosOpen && (
        // Emergency uses a fixed red in every theme: it is the only colour
        // in the app, so it can't be missed.
        <Dialog onClose={fold} label={`SOS from ${partner.display_name}`} variant="fullscreen" className="w-full max-w-md px-4">
          <div role="alertdialog" aria-labelledby="sos-title" aria-describedby="sos-body" className="card max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#a8182c] p-6 text-white">
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
                  <button
                    type="button"
                    onClick={showOnMap}
                    className="pill flex min-h-12 items-center justify-center gap-2 bg-white px-5 font-bold text-[#7a1020]"
                  >
                    <MapPinIcon size={18} /> See where on the map
                  </button>
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
              <button
                type="button"
                onClick={() => void handle()}
                disabled={answering}
                className="pill min-h-12 bg-[#1b1a1e] px-5 font-bold text-white disabled:opacity-80"
              >
                {answering ? "Letting them know…" : "I'm on it"}
              </button>
              {answerFailed && (
                <p className="text-center text-small font-semibold" role="alert">
                  Couldn&apos;t reach {partner.display_name}&apos;s phone. Check your connection and tap again, or call them.
                </p>
              )}
              {/* Shows what happened, so the tap never feels ignored. */}
              <button
                type="button"
                onClick={alarmOn ? silence : fold}
                className="min-h-11 text-small font-semibold underline underline-offset-2"
              >
                {alarmOn ? "Silence the alarm" : "Close for now"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
