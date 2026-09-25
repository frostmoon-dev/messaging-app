"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { haptic } from "@/lib/haptics";
import {
  graphemes,
  isMessageEffect,
  LETTER_EFFECTS,
  REPLAY_EVENT,
  SLAM_EVENT,
  type MessageEffect,
} from "@/lib/messages/effects";

/** How long each effect runs, in ms (letter effects add a little per letter). */
const DURATION: Record<MessageEffect, number> = {
  slam: 700,
  loud: 1100,
  gentle: 1600,
  ink: 0,
  shake: 900,
  ripple: 900,
  bloom: 1000,
  heartbeat: 1500,
};

/**
 * Plays a message's effect when it first appears and whenever its options
 * ask for a replay. Returns the effect, a key that changes per play, and
 * whether it's playing right now.
 */
export function useMessageEffect(messageId: string, rawEffect: unknown, animateIn: boolean, mine: boolean) {
  const effect = isMessageEffect(rawEffect) ? rawEffect : null;
  const reduce = useReducedMotion();
  const [play, setPlay] = useState(() => (effect && animateIn && !reduce ? 1 : 0));
  const [playing, setPlaying] = useState(play > 0);

  useEffect(() => {
    if (!effect) return;
    const onReplay = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== messageId || reduce) return;
      setPlay((n) => n + 1);
      setPlaying(true);
    };
    window.addEventListener(REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_EVENT, onReplay);
  }, [effect, messageId, reduce]);

  useEffect(() => {
    if (!effect || play === 0) return;
    if (effect === "slam") window.dispatchEvent(new CustomEvent(SLAM_EVENT));
    // Your partner's heartbeat reaches your hand (Android; iPhone only buzzes during a tap).
    if (effect === "heartbeat" && !mine) haptic("heart");
    const t = setTimeout(() => setPlaying(false), DURATION[effect] + 900);
    return () => clearTimeout(t);
  }, [effect, play, mine]);

  return { effect, play, playing: playing && play > 0 };
}

/** Animates the whole bubble (Slam, Loud, Gentle, Heartbeat). Other effects pass through. */
export function EffectBubble({
  effect,
  play,
  children,
}: {
  effect: MessageEffect | null;
  play: number;
  children: React.ReactNode;
}) {
  const controls = useAnimationControls();

  useEffect(() => {
    if (!effect || play === 0) return;
    let cancelled = false;
    const run = async () => {
      if (effect === "slam") {
        controls.set({ scale: 2.4, opacity: 0, rotate: -6, y: -30 });
        await controls.start({ scale: 1, opacity: 1, rotate: 0, y: 0, transition: { duration: 0.2, ease: [0.55, 0, 1, 0.45] } });
        if (!cancelled) await controls.start({ y: [0, 5, -2, 1, 0], transition: { duration: 0.35 } });
      } else if (effect === "loud") {
        await controls.start({
          scale: [1, 1.45, 1.45, 1.45, 1],
          rotate: [0, -4, 4, -3, 0],
          transition: { duration: 1.05, times: [0, 0.2, 0.45, 0.7, 1], ease: "easeInOut" },
        });
      } else if (effect === "gentle") {
        controls.set({ scale: 0.55, opacity: 0.35 });
        await controls.start({ scale: 1, opacity: 1, transition: { duration: 1.5, ease: [0.2, 0.8, 0.2, 1] } });
      } else if (effect === "heartbeat") {
        // Two lub-dubs; the honey glow is the CSS animation .effect-heartbeat.
        await controls.start({
          scale: [1, 1.12, 1, 1.18, 1, 1.12, 1, 1.18, 1],
          transition: { duration: 1.45, ease: "easeInOut" },
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [effect, play, controls]);

  return (
    <motion.div
      animate={controls}
      // A new key per heartbeat restarts its glow.
      key={effect === "heartbeat" ? play : undefined}
      className={effect === "heartbeat" && play > 0 ? "effect-heartbeat relative" : "relative"}
      style={{ transformOrigin: "center" }}
    >
      {children}
    </motion.div>
  );
}

/** Shake, Ripple and Bloom move each letter. Shown only while the effect plays. */
export function EffectLetters({ text, effect, play }: { text: string; effect: MessageEffect; play: number }) {
  // Words stay together so lines break where they normally would.
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  let index = 0;
  return (
    <span key={play}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, w) =>
          /^\s+$/.test(word) ? (
            <span key={w}>{word}</span>
          ) : (
            <span key={w} className="inline-block whitespace-nowrap">
              {graphemes(word).map((ch) => {
                const i = index++;
                return (
                  <motion.span key={i} className="inline-block" {...letterMotion(effect, i)}>
                    {ch}
                  </motion.span>
                );
              })}
            </span>
          ),
        )}
      </span>
    </span>
  );
}

function letterMotion(effect: MessageEffect, i: number) {
  if (effect === "shake") {
    const a = 1.5 + ((i * 7) % 5) / 2; // a little different per letter
    return {
      animate: { x: [0, -a, a, -a, a, 0], y: [0, a / 2, -a / 2, a / 3, 0, 0], rotate: [0, -6, 6, -4, 3, 0] },
      transition: { duration: 0.6, delay: (i % 4) * 0.02, repeat: 1 },
    };
  }
  if (effect === "ripple") {
    return {
      animate: { y: [0, -7, 0], scale: [1, 1.15, 1] },
      transition: { duration: 0.45, delay: i * 0.035, ease: "easeInOut" as const },
    };
  }
  // Bloom: each letter opens from a blur, overshoots and settles.
  return {
    initial: { opacity: 0, scale: 0.2, filter: "blur(4px)" },
    animate: { opacity: 1, scale: [0.2, 1.45, 1], filter: ["blur(4px)", "blur(0px)", "blur(0px)"] },
    transition: { duration: 0.55, delay: i * 0.03, ease: "easeOut" as const },
  };
}

export function isLetterEffect(effect: MessageEffect | null): effect is MessageEffect {
  return effect !== null && LETTER_EFFECTS.has(effect);
}
