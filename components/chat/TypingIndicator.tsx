"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePresence, useChat } from "@/components/providers/ChatProvider";

/** A small incoming-style bubble with three dots, where the reply will appear. */
export function TypingIndicator() {
  const { partnerTyping } = usePresence();
  const { partner } = useChat();

  return (
    <div className="pointer-events-none h-8 px-4" aria-live="polite">
      <AnimatePresence>
        {partnerTyping && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="ml-11 inline-flex h-7 items-center gap-1 rounded-full bg-incoming px-3"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="typing-dot block size-1.5 rounded-full bg-incoming-foreground"
                style={{ animationDelay: `${i * 0.15}s` }}
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">{partner.display_name} is typing</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
