// Send effects, like iMessage's: they play once when the message arrives
// (on both phones) and again from the message's options. Stored in
// messages.effect; unknown values show the message without an effect.

export const MESSAGE_EFFECTS = ["slam", "loud", "gentle", "ink", "shake", "ripple", "bloom", "heartbeat"] as const;
export type MessageEffect = (typeof MESSAGE_EFFECTS)[number];

export function isMessageEffect(value: unknown): value is MessageEffect {
  return typeof value === "string" && (MESSAGE_EFFECTS as readonly string[]).includes(value);
}

export const EFFECT_OPTIONS: Array<{ id: MessageEffect | null; label: string }> = [
  { id: null, label: "None" },
  { id: "slam", label: "Slam" },
  { id: "loud", label: "Loud" },
  { id: "gentle", label: "Gentle" },
  { id: "ink", label: "Invisible ink" },
  { id: "shake", label: "Shake" },
  { id: "ripple", label: "Ripple" },
  { id: "bloom", label: "Bloom" },
  { id: "heartbeat", label: "Heartbeat" },
];

/** Effects that animate each letter (text messages only). */
export const LETTER_EFFECTS: ReadonlySet<MessageEffect> = new Set(["shake", "ripple", "bloom"]);

export function effectLabel(effect: unknown) {
  return EFFECT_OPTIONS.find((o) => o.id === effect)?.label ?? null;
}

/** Splits text into user-visible characters (emoji stay whole). */
export function graphemes(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment);
  return Array.from(text);
}

// Asks one bubble to play its effect again (from the message's options).
export const REPLAY_EVENT = "napyru:replay-effect";
// A Slam shakes the whole chat for a moment.
export const SLAM_EVENT = "napyru:slam";
