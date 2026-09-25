"use client";

import { motion, useReducedMotion } from "framer-motion";

const PARTICLES = [
  { x: -46, y: -38, s: 0.5, r: -24 },
  { x: 44, y: -44, s: 0.55, r: 18 },
  { x: -58, y: 6, s: 0.4, r: -40 },
  { x: 58, y: 2, s: 0.42, r: 36 },
  { x: -20, y: -62, s: 0.36, r: -8 },
  { x: 22, y: -64, s: 0.34, r: 12 },
];

function Heart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.2 0 3.7 1.2 5.4 3.2 1.7-2 3.2-3.2 5.4-3.2 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21Z"
        fill="#ff3b5c"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="0.6"
      />
    </svg>
  );
}

/**
 * The double-tap heart: a big heart pops with a little overshoot, small
 * hearts scatter, then everything floats up and fades. About 0.9 s.
 */
export function HeartBurst() {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <motion.span
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.6 }}
      >
        <Heart className="size-14" />
      </motion.span>
    );
  }
  return (
    <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden="true">
      <motion.span
        className="absolute"
        initial={{ scale: 0, opacity: 0, y: 0, rotate: -12 }}
        animate={{ scale: [0, 1.35, 0.92, 1.05, 1], opacity: [0, 1, 1, 1, 0], y: [0, 0, 0, 0, -26], rotate: [-12, 6, -3, 0, 0] }}
        transition={{ duration: 0.9, times: [0, 0.28, 0.45, 0.6, 1], ease: "easeOut" }}
      >
        <Heart className="size-16 drop-shadow-[0_6px_14px_rgba(255,59,92,0.45)]" />
      </motion.span>
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{ x: p.x, y: p.y, scale: [0, p.s, p.s * 0.8], opacity: [0, 1, 0], rotate: p.r }}
          transition={{ duration: 0.75, delay: 0.12 + i * 0.02, ease: [0.2, 0.8, 0.3, 1] }}
        >
          <Heart className="size-8" />
        </motion.span>
      ))}
    </span>
  );
}
