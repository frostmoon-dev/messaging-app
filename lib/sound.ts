import { readPref, writePref } from "./prefs";

// Tiny synthesized cues (no audio files, nothing copied). Off by default.
export type SoundCue = "received" | "sent" | "navigate";

const CUES: Record<SoundCue, Array<{ freq: number; at: number; dur: number; gain: number; type?: OscillatorType }>> = {
  received: [
    { freq: 880, at: 0, dur: 0.07, gain: 0.08, type: "triangle" },
    { freq: 1320, at: 0.07, dur: 0.1, gain: 0.07, type: "triangle" },
  ],
  sent: [{ freq: 660, at: 0, dur: 0.06, gain: 0.06, type: "square" }],
  navigate: [{ freq: 520, at: 0, dur: 0.035, gain: 0.04, type: "square" }],
};

let ctx: AudioContext | null = null;

export function isSoundEnabled() {
  return readPref("sound") === "on";
}

export function setSoundEnabled(on: boolean) {
  writePref("sound", on ? "on" : null);
  if (on) void getContext()?.resume();
}

function getContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

export function playSound(cue: SoundCue) {
  if (!isSoundEnabled()) return;
  const audio = getContext();
  if (!audio || audio.state === "closed") return;
  if (audio.state === "suspended") void audio.resume();
  const now = audio.currentTime;
  for (const note of CUES[cue]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(0, now + note.at);
    gain.gain.linearRampToValueAtTime(note.gain, now + note.at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + note.at);
    osc.stop(now + note.at + note.dur + 0.02);
  }
}
