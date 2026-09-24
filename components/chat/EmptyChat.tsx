"use client";

import { motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";

export function EmptyChat() {
  const { partner } = useChat();
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.9, 0.1, 1] }}
      className="mx-auto my-16 flex max-w-xs flex-col items-center px-6 text-center"
    >
      <div className="relative mb-6">
        <span className="halftone absolute -inset-4 -rotate-6 opacity-40" aria-hidden="true" />
        <p className="text-display relative -rotate-3 bg-foreground px-4 py-2 text-3xl text-background">
          Dead air
        </p>
      </div>
      <p className="text-display text-lg tracking-wide">No messages yet</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-strong">
        The first line is always the hardest. Say something to {partner.display_name} — anything.
      </p>
    </motion.div>
  );
}
