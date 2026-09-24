// The SOS warning tone: a two-note siren made with Web Audio (no audio
// files). It plays even when app sounds are off, because it's an
// emergency. A phone on silent can still mute it, and browsers only allow
// sound after the person has tapped the page at least once.

let ctx: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/** Starts the siren and returns a function that stops it. */
export function startAlarm(): () => void {
  const audio = context();
  if (!audio) return () => {};
  void audio.resume().catch(() => {});

  const gain = audio.createGain();
  gain.gain.value = 0;
  gain.connect(audio.destination);
  const osc = audio.createOscillator();
  osc.type = "square";
  osc.connect(gain);

  // 0.45 s high, 0.45 s low, repeating, with short fades so it doesn't click.
  const start = audio.currentTime + 0.05;
  const STEP = 0.45;
  const CYCLES = 80; // about a minute; "Silence" or "I'm on it" stops it sooner
  for (let i = 0; i < CYCLES * 2; i++) {
    const t = start + i * STEP;
    osc.frequency.setValueAtTime(i % 2 ? 660 : 880, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.setValueAtTime(0.18, t + STEP - 0.04);
    gain.gain.linearRampToValueAtTime(0, t + STEP - 0.01);
  }
  osc.start(start);
  osc.stop(start + CYCLES * 2 * STEP);

  if ("vibrate" in navigator) navigator.vibrate([600, 200, 600, 200, 600, 200, 600]);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      gain.gain.cancelScheduledValues(audio.currentTime);
      gain.gain.setValueAtTime(0, audio.currentTime);
      osc.stop();
    } catch {
      // Already stopped.
    }
    if ("vibrate" in navigator) navigator.vibrate(0);
  };
}
