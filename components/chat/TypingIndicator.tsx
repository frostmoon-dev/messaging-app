"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePresence, useChat } from "@/components/providers/ChatProvider";

export function TypingIndicator() {
  const { partnerTyping } = usePresence();
  const { partner } = useChat();

  return (
    <div className="pointer-events-none h-6 px-4" aria-live="polite">
      <AnimatePresence>
        {partnerTyping && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            className="text-display flex items-center gap-2 text-[11px] tracking-[0.2em] text-muted-strong"
          >
            <span className="flex h-3 items-end gap-[3px]" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="typing-bar block h-3 w-[3px] bg-accent-strong"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
            <span>{partner.display_name} is typing…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
