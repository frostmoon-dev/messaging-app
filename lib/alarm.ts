// The SOS alarm: a loud, fast "yelp" siren made with Web Audio (no audio
// files). It plays even when app sounds are off, because it's an emergency.
//
// iPhone rules it has to work around:
// - Sound only starts after a tap. `primeAlarm()` is called on your first tap
//   in the app, so an SOS that arrives later can sound on its own.
// - Web Audio normally obeys the silent switch. While the alarm plays, the
//   page asks for a "playback" audio session, which plays through it
//   (Safari 16.4+). Afterwards the page goes back to normal.
// - A web page can't raise the phone's volume. The alarm plays at full
//   volume within whatever the volume is set to.

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** Stop on its own after this long, in case nobody is there to silence it. */
const MAX_MS = 3 * 60 * 1000;

let ctx: AudioContext | null = null;
/** Alarms playing right now (a new SOS can start one as the last stops). */
let playing = 0;

function context() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === "closed") ctx = new Ctor();
  return ctx;
}

function setSession(type: string) {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // Not allowed here; the alarm still plays, just not through silent mode.
  }
}

/**
 * Unlocks sound for the alarm. Must run inside a tap. Returns true once
 * the phone has allowed it.
 */
export async function primeAlarm() {
  const audio = context();
  if (!audio) return false;
  if (audio.state === "running") return true;
  try {
    await audio.resume();
  } catch {
    return false;
  }
  // Unlocked: rest until an SOS needs it.
  const ok = (audio.state as AudioContextState) === "running";
  if (ok && playing === 0) void audio.suspend().catch(() => {});
  return ok;
}

/** Starts the siren and returns a function that stops it. */
export function startAlarm(): () => void {
  const audio = context();
  if (!audio) return () => {};
  playing++;
  setSession("playback");
  void audio.resume().catch(() => {});

  // Two harsh tones a fifth apart, sweeping 900 → 2400 Hz about 3 times a
  // second: the pitch range phone speakers and ears are loudest in.
  const sweep = audio.createOscillator();
  sweep.type = "sawtooth";
  sweep.frequency.value = 3.2;
  const depth = audio.createGain();
  depth.gain.value = 750;
  sweep.connect(depth);

  const low = audio.createOscillator();
  low.type = "square";
  low.frequency.value = 1650;
  depth.connect(low.frequency);

  const high = audio.createOscillator();
  high.type = "sawtooth";
  high.frequency.value = 1650 * 1.5;
  const highDepth = audio.createGain();
  highDepth.gain.value = 750 * 1.5;
  sweep.connect(highDepth).connect(high.frequency);

  // Pushed hard into a limiter: as loud as possible without crackling.
  const mix = audio.createGain();
  mix.gain.value = 0;
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.05;
  const master = audio.createGain();
  master.gain.value = 1;
  low.connect(mix);
  high.connect(mix);
  mix.connect(limiter).connect(master).connect(audio.destination);

  const start = audio.currentTime + 0.03;
  mix.gain.setValueAtTime(0, start);
  mix.gain.linearRampToValueAtTime(0.9, start + 0.05);
  for (const osc of [sweep, low, high]) osc.start(start);

  if ("vibrate" in navigator) navigator.vibrate([600, 200, 600, 200, 600, 200, 600]);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    playing--;
    clearTimeout(timer);
    try {
      const now = audio.currentTime;
      mix.gain.cancelScheduledValues(now);
      mix.gain.setValueAtTime(mix.gain.value, now);
      mix.gain.linearRampToValueAtTime(0, now + 0.05);
      for (const osc of [sweep, low, high]) osc.stop(now + 0.08);
    } catch {
      // Already stopped.
    }
    // Back to normal: other app sounds follow the silent switch again.
    setTimeout(() => {
      if (playing > 0) return;
      setSession("auto");
      void audio.suspend().catch(() => {});
    }, 150);
    if ("vibrate" in navigator) navigator.vibrate(0);
  };
  const timer = setTimeout(stop, MAX_MS);
  return stop;
}
