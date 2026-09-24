"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { CloseIcon } from "@/components/ui/icons";
import { UiMark } from "@/components/ui/UiMark";
import { dismissPrompt, requestNotificationPermission } from "@/lib/notifications";

/** Asked only after the user has sent something, never on first load. */
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="mx-4 mb-2"
          role="region"
          aria-label="Notification settings"
        >
          <div className="cut-corners flex items-center gap-3 bg-panel-strong p-3">
            <UiMark name="alert" className="size-7 bg-accent" />
            <p className="flex-1 text-sm leading-snug">
              Want a heads-up when {partner.display_name} messages you while you&apos;re away?
            </p>
            <button
              type="button"
              onClick={enable}
              className="shape-tag text-display min-h-11 bg-accent px-4 text-sm tracking-wider text-accent-foreground hover:bg-accent-strong"
            >
              Turn on
            </button>
            <button type="button" onClick={later} className="flex size-11 items-center justify-center text-muted-strong hover:text-foreground" aria-label="Not now">
              <CloseIcon size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
