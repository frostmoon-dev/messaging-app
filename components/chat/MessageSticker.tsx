"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/app";

const STICKER_MAX = 160;
const GIF_MAX_W = 240;
const GIF_MAX_H = 300;

function fit(width: number | null, height: number | null, maxW: number, maxH: number) {
  if (!width || !height) return { width: maxW, height: maxW };
  const scale = Math.min(maxW / width, maxH / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const q = window.matchMedia(REDUCE);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
}
function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCE).matches, () => false);
}

/** Stickers sit on the chat without a bubble, like in every messenger. */
export function MessageSticker({ message }: { message: ChatMessage }) {
  const external = message.image_url?.startsWith("https://") ?? false;
  const { url: signed, failed } = useSignedUrl("stickers", external ? null : message.image_url);
  const src = external ? message.image_url : signed;
  const box = fit(message.image_width, message.image_height, STICKER_MAX, STICKER_MAX);

  return (
    <span className="relative block" style={{ width: box.width, height: box.height }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL or GIPHY media, not optimisable
        <img src={src} alt={message.content ? `Sticker: ${message.content}` : "Sticker"} className="size-full object-contain" draggable={false} />
      ) : failed ? (
        <span className="flex size-full items-center justify-center rounded-2xl bg-panel-strong text-small text-muted">Sticker unavailable</span>
      ) : (
        <span className="skeleton block size-full rounded-2xl" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * GIFs are GIPHY MP4s: smaller than GIF files and they can be paused.
 * They loop silently; with "reduce motion" on they wait for a tap.
 */
export function MessageGif({ message, tailClass }: { message: ChatMessage; tailClass?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(!reduce);
  const box = fit(message.image_width, message.image_height, GIF_MAX_W, GIF_MAX_H);
  const label = message.content ? `GIF: ${message.content}` : "GIF";

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [playing]);

  return (
    <button
      type="button"
      onClick={() => setPlaying((p) => !p)}
      // Explicit height, not aspect-ratio: iPhone Safari can ignore aspect-ratio
      // on a <button>, leaving the box half as tall as the video, so the
      // next message slid on top of it. translateZ(0) makes Safari clip the
      // video to the rounded corners.
      className={cn("relative block max-w-full overflow-hidden rounded-[20px] bg-panel-strong [transform:translateZ(0)]", tailClass)}
      style={{ width: box.width, height: box.height }}
      aria-label={`${label}. ${playing ? "Pause" : "Play"}.`}
    >
      <video
        ref={ref}
        src={message.image_url ?? undefined}
        muted
        loop
        playsInline
        preload="auto"
        autoPlay={!reduce}
        className="size-full object-cover"
        aria-hidden="true"
      />
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-meta font-bold text-white" aria-hidden="true">
        {playing ? "GIF" : "▶ GIF"}
      </span>
    </button>
  );
}
