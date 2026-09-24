"use client";

import { motion } from "framer-motion";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { formatLongDate } from "@/lib/time";
import type { MemoryRow } from "@/types/app";

/** Width / height of a memory's photo, kept between 1:2 and 2:1 so one photo can't take over the page. */
export function memoryAspect(memory: Pick<MemoryRow, "image_width" | "image_height">) {
  const { image_width: w, image_height: h } = memory;
  if (!w || !h) return 1;
  return Math.min(2, Math.max(0.5, w / h));
}

/** Photos keep their own shape (as cropped when added), so nothing important is cut off. */
export function MemoryCard({ memory, onOpen }: { memory: MemoryRow; onOpen: () => void }) {
  const { url, failed } = useSignedUrl("memories", memory.image_path);

  return (
    <motion.li layout exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full text-left"
        aria-label={`${memory.title}, ${formatLongDate(memory.memory_date)}. Open memory.`}
      >
        <span
          className="relative block w-full overflow-hidden rounded-[18px_5px_18px_18px] border border-border bg-panel-strong transition-[filter] group-hover:brightness-110"
          style={{ aspectRatio: memoryAspect(memory) }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket
            <img
              src={url}
              alt=""
              loading="lazy"
              className="size-full object-cover"
              draggable={false}
            />
          ) : failed ? (
            <span className="flex size-full items-center justify-center bg-panel-strong text-small text-muted-strong">Photo unavailable</span>
          ) : (
            <span className="skeleton block size-full" />
          )}
        </span>
        <span className="mt-2 block truncate font-semibold group-hover:underline">{memory.title}</span>
        <span className="block text-meta text-muted">{formatLongDate(memory.memory_date)}</span>
      </button>
    </motion.li>
  );
}
