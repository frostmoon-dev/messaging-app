"use client";

import { motion } from "framer-motion";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { formatLongDate } from "@/lib/time";
import type { MemoryRow } from "@/types/app";

const TILTS = [-2, 1.5, -1, 2, -1.5, 1];

export function MemoryCard({ memory, index, onOpen }: { memory: MemoryRow; index: number; onOpen: () => void }) {
  const { url, failed } = useSignedUrl("memories", memory.image_path);
  const tilt = TILTS[index % TILTS.length];

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.03 }}
    >
      <motion.button
        type="button"
        onClick={onOpen}
        style={{ rotate: tilt }}
        whileHover={{ rotate: 0, y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="block w-full bg-incoming p-2 pb-3 text-left text-incoming-foreground shadow-[4px_4px_0_var(--accent)]"
        aria-label={`${memory.title}, ${formatLongDate(memory.memory_date)}. Open memory.`}
      >
        <span className="relative block aspect-square w-full overflow-hidden bg-black/10">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket
            <img src={url} alt="" loading="lazy" className="size-full object-cover" draggable={false} />
          ) : failed ? (
            <span className="flex size-full items-center justify-center text-xs opacity-60">Image unavailable</span>
          ) : (
            <span className="skeleton block size-full" />
          )}
        </span>
        <span className="text-display mt-2 block truncate text-lg">{memory.title}</span>
        <span className="block text-[11px] tracking-wide opacity-60">{formatLongDate(memory.memory_date)}</span>
      </motion.button>
    </motion.li>
  );
}
