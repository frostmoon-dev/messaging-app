"use client";

import { useState } from "react";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/app";

const MAX_W = 280;
const MAX_H = 360;

function fit(width: number | null, height: number | null) {
  if (!width || !height) return { width: MAX_W, height: 220 };
  const scale = Math.min(1, MAX_W / width, MAX_H / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function MessageImage({
  message,
  localPreview,
  onOpen,
}: {
  message: ChatMessage;
  localPreview?: string;
  onOpen: (src: string, alt: string) => void;
}) {
  const preview = message.local?.previewUrl ?? localPreview;
  // Use the local blob while it exists; avoids a flash after upload.
  const { url: remote, failed } = useSignedUrl("chat-images", preview ? null : message.image_url);
  const src = preview ?? remote;
  const [loaded, setLoaded] = useState(false);
  const box = fit(message.image_width, message.image_height);
  const uploading = message.local?.status === "sending" && !message.local.uploaded;
  const progress = Math.round((message.local?.progress ?? 0) * 100);
  const alt = message.content ? `Photo: ${message.content}` : "Photo";

  return (
    <button
      type="button"
      className="relative block max-w-full overflow-hidden bg-black/20"
      style={{ width: box.width, aspectRatio: `${box.width} / ${box.height}` }}
      onClick={() => src && onOpen(src, alt)}
      disabled={!src}
      aria-label={`Open ${alt.toLowerCase()}`}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL / local blob, not optimisable
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn("size-full object-cover transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
        />
      )}
      {!loaded && !failed && <span className="skeleton absolute inset-0" aria-hidden="true" />}
      {failed && !src && (
        <span className="absolute inset-0 flex items-center justify-center text-small text-muted">Photo unavailable</span>
      )}
      {uploading && (
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/70 px-2 py-1.5">
          <span
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span className="block h-full rounded-full bg-white transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </span>
          <span className="font-mono text-meta text-white">{progress}%</span>
        </span>
      )}
    </button>
  );
}
