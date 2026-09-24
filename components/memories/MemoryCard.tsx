"use client";

import { motion } from "framer-motion";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { formatLongDate } from "@/lib/time";
import type { MemoryRow } from "@/types/app";

export function MemoryCard({ memory, onOpen }: { memory: MemoryRow; onOpen: () => void }) {
  const { url, failed } = useSignedUrl("memories", memory.image_path);

  return (
    <motion.li layout exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full rounded-card text-left"
        aria-label={`${memory.title}, ${formatLongDate(memory.memory_date)}. Open memory.`}
      >
        <span className="relative block aspect-square w-full overflow-hidden rounded-card bg-panel-strong">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket
            <img
              src={url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              draggable={false}
            />
          ) : failed ? (
            <span className="flex size-full items-center justify-center text-small text-muted">Photo unavailable</span>
          ) : (
            <span className="skeleton block size-full" />
          )}
        </span>
        <span className="mt-2 block truncate font-semibold">{memory.title}</span>
        <span className="block text-meta text-muted">{formatLongDate(memory.memory_date)}</span>
      </button>
    </motion.li>
  );
}
