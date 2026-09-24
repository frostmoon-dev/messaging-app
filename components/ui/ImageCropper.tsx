"use client";

import { useEffect, useRef, useState } from "react";
import { clampCrop, cropSize, MAX_ZOOM, MIN_ZOOM, panCrop, type Crop } from "@/lib/storage/crop";
import { cn } from "@/lib/utils";

export type AspectOption = { id: string; label: string; value: number };

/**
 * Drag to move, pinch / scroll / slider to zoom. Controlled: the parent keeps
 * the crop and turns it into pixels with cropRect() when it saves.
 * `round` shows a circle guide (avatars); the saved image is still square.
 */
export function ImageCropper({
  src,
  width,
  height,
  aspect,
  crop,
  onCropChange,
  aspects,
  aspectId,
  onAspectChange,
  round = false,
  label = "Crop photo",
}: {
  src: string;
  width: number;
  height: number;
  aspect: number;
  crop: Crop;
  onCropChange: (next: Crop | ((prev: Crop) => Crop)) => void;
  aspects?: AspectOption[];
  aspectId?: string;
  onAspectChange?: (id: string) => void;
  round?: boolean;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [box, setBox] = useState({ width: 0, maxHeight: 360 });
  const [dragging, setDragging] = useState(false);

  // The frame is as wide as the space allows but never taller than half the screen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, maxHeight: Math.min(window.innerHeight * 0.5, 440) });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const frameWidth = Math.min(box.width, box.maxHeight * aspect);
  const frameHeight = frameWidth / aspect;

  const c = clampCrop(crop, width, height, aspect);
  const visible = cropSize(width, height, aspect, c.zoom);
  const scale = frameWidth / visible.width; // screen px per image px

  const zoomBy = (factor: number) => onCropChange((prev) => clampCrop({ ...prev, zoom: prev.zoom * factor }, width, height, aspect));
  const pan = (dx: number, dy: number) => onCropChange((prev) => panCrop(prev, dx, dy, frameWidth, width, height, aspect));

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      onCropChange((prev) => clampCrop({ ...prev, zoom: prev.zoom * factor }, width, height, aspect));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onCropChange, width, height, aspect]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const map = pointers.current;
    const last = map.get(e.pointerId);
    if (!last) return;
    if (map.size === 1) {
      pan(e.clientX - last.x, e.clientY - last.y);
    } else if (map.size === 2) {
      // Pinch: zoom by how much the distance between the two fingers changed.
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(last.x - other.x, last.y - other.y);
        const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (before > 0) zoomBy(after / before);
      }
    }
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 12;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      pan(...moves[e.key]);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.1);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomBy(1 / 1.1);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="flex w-full justify-center">
        {frameWidth > 0 && (
          <div
            ref={frameRef}
            role="group"
            tabIndex={0}
            aria-label={`${label}. Drag or use the arrow keys to move, pinch or use plus and minus to zoom.`}
            className={cn("relative touch-none overflow-hidden rounded-lg bg-black select-none", dragging ? "cursor-grabbing" : "cursor-grab")}
            style={{ width: frameWidth, height: frameHeight }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: width * scale,
                height: height * scale,
                left: frameWidth / 2 - c.cx * width * scale,
                top: frameHeight / 2 - c.cy * height * scale,
              }}
            />
            {/* Rule-of-thirds guide while moving. */}
            <div className={cn("pointer-events-none absolute inset-0 transition-opacity", dragging ? "opacity-100" : "opacity-0")} aria-hidden="true">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
            </div>
            {round && (
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-2 ring-white/80" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      <p className="text-center text-small text-muted-strong">Drag to move. Pinch or use the slider to zoom.</p>

      <label className="flex items-center gap-3 text-small font-semibold text-muted-strong">
        Zoom
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={c.zoom}
          onChange={(e) => onCropChange((prev) => clampCrop({ ...prev, zoom: Number(e.target.value) }, width, height, aspect))}
          className="h-11 flex-1 accent-[var(--accent)]"
        />
      </label>

      {aspects && aspects.length > 1 && (
        <div role="radiogroup" aria-label="Shape" className="flex flex-wrap gap-2">
          {aspects.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={a.id === aspectId}
              onClick={() => onAspectChange?.(a.id)}
              className={cn(
                "min-h-11 rounded-full border-2 px-4 text-small font-semibold transition-colors",
                a.id === aspectId ? "border-accent bg-accent text-accent-foreground" : "border-field-border text-foreground hover:bg-panel-strong",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
