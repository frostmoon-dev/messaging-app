"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { CloseIcon } from "@/components/ui/icons";
import { UiMark } from "@/components/ui/UiMark";
import { dismissPrompt, requestNotificationPermission } from "@/lib/notifications";
import { enablePush } from "@/lib/push";
import { devLog } from "@/lib/utils";

/** Asked only after the user has sent something, never on first load. */
export function NotificationPrompt({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { partner } = useChat();

  const enable = async () => {
    const result = await requestNotificationPermission();
    if (result === "granted") await enablePush().catch((error) => devLog("push subscribe failed", error));
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
          <div className="p5-panel flex items-center gap-3 bg-panel-strong p-3">
            <UiMark name="alert" className="size-7 bg-accent" />
            <p className="flex-1 text-small">
              Get a notification when {partner.display_name} writes while you&apos;re away?
            </p>
            <button
              type="button"
              onClick={enable}
              className="p5-button min-h-11 bg-accent px-4 text-small font-bold text-accent-foreground hover:bg-accent-hover"
            >
              Turn on
            </button>
            <button
              type="button"
              onClick={later}
              className="flex size-11 items-center justify-center text-muted-strong hover:bg-panel hover:text-foreground"
              aria-label="Not now"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
