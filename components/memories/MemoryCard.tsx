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
        className="group block w-full text-left"
        aria-label={`${memory.title}, ${formatLongDate(memory.memory_date)}. Open memory.`}
      >
        <span className="p5-frame relative block aspect-square w-full overflow-hidden bg-frame p-1">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket
            <img
              src={url}
              alt=""
              loading="lazy"
              className="size-full bg-panel-strong object-cover"
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
