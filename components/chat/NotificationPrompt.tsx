"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { BellIcon, CloseIcon } from "@/components/ui/icons";
import { dismissPrompt, requestNotificationPermission } from "@/lib/notifications";

/** Asked only after the user has sent something — never on first load. */
export function NotificationPrompt({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { partner } = useChat();

  const enable = async () => {
    await requestNotificationPermission();
    dismissPrompt();
    onDone();
  };
  const later = () => {
    dismissPrompt();
    onDone();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="mx-3 mb-2 sm:mx-5"
          role="region"
          aria-label="Notification settings"
        >
          <div className="cut-corners flex items-center gap-3 border-l-4 border-accent bg-panel-strong p-3">
            <BellIcon size={20} className="shrink-0 text-accent-strong" />
            <p className="flex-1 text-[13px] leading-snug">
              Want a heads-up when {partner.display_name} messages you while you&apos;re away?
            </p>
            <button
              type="button"
              onClick={enable}
              className="shape-tag text-display min-h-9 bg-accent px-3 text-xs tracking-wider text-accent-foreground"
            >
              Turn on
            </button>
            <button type="button" onClick={later} className="p-1 text-muted hover:text-foreground" aria-label="Not now">
              <CloseIcon size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
