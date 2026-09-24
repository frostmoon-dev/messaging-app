"use client";

import { Dialog } from "./Dialog";
import { CloseIcon } from "./icons";

export function ImageViewer({ src, alt, onClose, children }: {
  src: string;
  alt: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog onClose={onClose} label={alt} variant="fullscreen" className="relative flex max-h-full w-full flex-col items-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 flex size-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        aria-label="Close image"
        autoFocus
      >
        <CloseIcon size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket */}
      <img
        src={src}
        alt={alt}
        className="max-h-[calc(var(--app-height,100dvh)-9rem)] max-w-full rounded-card object-contain"
        onClick={onClose}
      />
      {children}
    </Dialog>
  );
}
