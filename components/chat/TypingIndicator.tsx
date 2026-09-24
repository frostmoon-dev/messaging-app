"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePresence, useChat } from "@/components/providers/ChatProvider";

/**
 * The game's "talk" speech bubble with three dots, where the reply will
 * appear. Same colour as an incoming message.
 */
export function TypingIndicator() {
  const { partnerTyping } = usePresence();
  const { partner } = useChat();

  return (
    <div className="pointer-events-none relative h-10 px-4" aria-live="polite">
      <AnimatePresence>
        {partnerTyping && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            // Same shape as an incoming bubble, holding three dots.
            className="bubble-in ml-11 inline-flex h-9 items-center gap-1 bg-incoming px-3.5"
          >
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="typing-dot block size-1.5 rounded-full bg-incoming-foreground"
                  style={{ animationDelay: `${i * 0.15}s` }}
                  aria-hidden="true"
                />
              ))}
            </span>
            <span className="sr-only">{partner.display_name} is typing</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
