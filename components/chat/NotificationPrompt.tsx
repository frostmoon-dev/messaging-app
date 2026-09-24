"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { BellIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
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
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-panel p-3">
            <BellIcon size={20} className="shrink-0 text-muted-strong" />
            <p className="min-w-40 flex-1 text-small">
              Get notified when {partner.display_name} writes while you are away?
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={later}>Not now</Button>
              <Button onClick={enable}>Turn on</Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
