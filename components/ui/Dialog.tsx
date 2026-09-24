"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Native <dialog> (focus trap, Esc, top layer). Sheets rise from the
 * bottom on phones (close to the thumb) and centre on larger screens.
 * Mount it only while open.
 */
export function Dialog({
  onClose,
  label,
  children,
  className,
  variant = "sheet",
}: {
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  variant?: "sheet" | "fullscreen";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close();
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={cn(
        "m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/70",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "pointer-events-none flex h-full w-full",
          variant === "sheet" ? "items-end justify-center sm:items-center" : "items-center justify-center",
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: variant === "sheet" ? 24 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn("pointer-events-auto", className)}
        >
          {children}
        </motion.div>
      </div>
    </dialog>
  );
}
