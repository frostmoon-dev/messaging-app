"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePresence } from "@/components/providers/ChatProvider";
import { MESSAGES } from "@/lib/errors";

export function ConnectionBanner() {
  const { connection } = usePresence();
  const [slowConnect, setSlowConnect] = useState(false);

  useEffect(() => {
    if (connection !== "connecting") return;
    const t = setTimeout(() => setSlowConnect(true), 6000);
    return () => clearTimeout(t);
  }, [connection]);

  const text =
    connection === "offline"
      ? MESSAGES.offline
      : connection === "reconnecting"
        ? MESSAGES.connection
        : connection === "connecting" && slowConnect
          ? "Connecting…"
          : null;

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key="banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
          role="status"
        >
          <div className="text-display flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-[12px] tracking-[0.2em] text-background">
            <span className="size-2 animate-pulse bg-accent" aria-hidden="true" />
            {text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
