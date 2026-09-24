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
          initial={{ height: 0 }}
          animate={{ height: "auto" }}
          exit={{ height: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden"
          role="status"
        >
          <p className="px-4 pb-2 text-center text-small font-semibold text-muted-strong">{text}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
