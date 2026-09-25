"use client";

import { useEffect, useRef, useState } from "react";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { formatDuration } from "@/lib/audio/recorder";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/app";

// Only one voice message plays at a time.
const PLAY_EVENT = "napyru:voice-play";
const SPEEDS = [1, 1.5, 2];

/**
 * A voice message: play/pause, a waveform that fills as it plays, the time,
 * and a speed switch (1×, 1.5×, 2×) like WhatsApp's.
 */
export function MessageVoice({ message, mine, localPreview }: { message: ChatMessage; mine: boolean; localPreview?: string }) {
  const preview = message.local?.previewUrl ?? localPreview;
  // The recording is only fetched once you press play.
  const [wanted, setWanted] = useState(false);
  const { url: remote, failed } = useSignedUrl("voice", preview || !wanted ? null : message.image_url);
  const src = preview ?? remote;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const duration = message.audio_duration_ms ?? 0;
  const peaks = (message.audio_peaks || "3".repeat(40)).split("").map(Number);
  const progress = duration ? Math.min(1, position / duration) : 0;

  // Stop when another voice message starts.
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== message.id) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOther);
    return () => window.removeEventListener(PLAY_EVENT, onOther);
  }, [message.id]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const start = async (url: string) => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(url);
      audio.preload = "auto";
      audio.ontimeupdate = () => setPosition(audio!.currentTime * 1000);
      audio.onplay = () => setPlaying(true);
      audio.onpause = () => setPlaying(false);
      audio.onended = () => {
        setPlaying(false);
        setPosition(0);
      };
      audioRef.current = audio;
    }
    audio.playbackRate = speed;
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: message.id }));
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  // Pressed play before the link arrived: start as soon as it does.
  useEffect(() => {
    if (wanted && src && !audioRef.current) void start(src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, src]);

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      return;
    }
    if (src) void start(src);
    else setWanted(true);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  // Tap or drag on the waveform to jump.
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const at = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = (at * duration) / 1000;
    setPosition(at * duration);
  };

  const loading = wanted && !src && !failed;

  return (
    <div className="flex w-[min(15rem,60vw)] items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={toggle}
        // Taps here play; they shouldn't also count toward a double-tap heart or long-press.
        onPointerDown={(e) => e.stopPropagation()}
        disabled={failed}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90",
          mine ? "bg-outgoing-foreground text-outgoing" : "bg-love text-love-foreground",
        )}
        aria-label={playing ? "Pause voice message" : `Play voice message, ${formatDuration(duration)}`}
      >
        {loading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
        ) : playing ? (
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className="flex h-7 cursor-pointer items-center gap-[2px]"
          onPointerDown={(e) => {
            e.stopPropagation();
            seek(e);
          }}
          onPointerMove={(e) => e.buttons === 1 && seek(e)}
          aria-hidden="true"
        >
          {peaks.map((p, i) => (
            <span
              key={i}
              className={cn(
                // Bars share the width, so all 40 fit any bubble.
                "min-w-px flex-1 rounded-full transition-colors",
                i / peaks.length < progress ? (mine ? "bg-outgoing-foreground" : "bg-love") : "bg-current opacity-35",
              )}
              style={{ height: `${Math.max(3, 3 + p * 2.4)}px` }}
            />
          ))}
        </div>
        <div className="mt-0.5 flex items-center justify-between font-mono text-meta opacity-75">
          <span>{failed ? "Unavailable" : formatDuration(playing || position ? position : duration)}</span>
          {(playing || position > 0) && (
            <button type="button" onClick={cycleSpeed} onPointerDown={(e) => e.stopPropagation()} className="rounded-full px-1.5 font-sans font-bold" aria-label={`Playback speed ${speed}×`}>
              {speed}×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
