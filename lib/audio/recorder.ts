// Records a voice message: the audio, how long it is, and a small waveform
// (loudness over time) for the bubble to draw.

export const MAX_VOICE_MS = 5 * 60 * 1000;
const BARS = 40;

export type Recording = {
  blob: Blob;
  /** Without codec details, e.g. "audio/mp4", as storage expects. */
  contentType: string;
  extension: string;
  durationMs: number;
  /** One digit 0–9 per bar, e.g. "0357986420…". */
  peaks: string;
};

export type Recorder = {
  /** Current loudness, 0–1, for a live meter. */
  level: () => number;
  elapsedMs: () => number;
  stop: () => Promise<Recording>;
  cancel: () => void;
};

export class RecorderError extends Error {}

/** MP4 (AAC) first: iPhone records it and every browser plays it. */
function pickFormat() {
  const candidates = ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionFor(contentType: string) {
  if (contentType === "audio/mp4" || contentType === "audio/aac") return "m4a";
  if (contentType === "audio/ogg") return "ogg";
  return "webm";
}

export function voiceSupported() {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Squeezes loudness samples into `BARS` digits, scaled so the loudest bar is 9. */
export function toPeaks(samples: number[], bars = BARS) {
  if (!samples.length) return "0".repeat(bars);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * samples.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * samples.length) / bars));
    let max = 0;
    for (let j = from; j < to && j < samples.length; j++) max = Math.max(max, samples[j]);
    out.push(max);
  }
  const loudest = Math.max(...out, 0.0001);
  return out.map((v) => Math.min(9, Math.round((v / loudest) * 9))).join("");
}

/** Why the microphone couldn't start, in words that say what to do. */
function micError(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new RecorderError(
      "The microphone is blocked. On iPhone: Settings → Apps → Safari → Microphone → Allow (or Ask), then close and reopen Napyru.",
    );
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return new RecorderError("No microphone found on this device.");
  if (name === "NotReadableError" || name === "AbortError") {
    return new RecorderError("The microphone is busy (a call or another app?). Try again in a moment.");
  }
  return new RecorderError("Couldn't start the microphone. Close and reopen the app, then try again.");
}

export async function startRecording(): Promise<Recorder> {
  if (!voiceSupported()) throw new RecorderError("Voice messages aren't supported in this browser.");

  // The level meter's audio context is made now, while we're still inside
  // your tap: iPhone keeps one made later silent.
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const audio = Ctor ? new Ctor() : null;
  void audio?.resume().catch(() => {});

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (error) {
    void audio?.close().catch(() => {});
    throw micError(error);
  }

  // Preferred format first; if the phone refuses those settings, its default.
  const mimeType = pickFormat();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48_000 } : undefined);
  } catch {
    recorder = new MediaRecorder(stream);
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  // Loudness, sampled 10 times a second, for the waveform and the live meter.
  const analyser = audio?.createAnalyser() ?? null;
  if (audio && analyser) {
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
  }
  const buffer = new Float32Array(analyser?.fftSize ?? 0);
  const samples: number[] = [];
  let current = 0;
  const measure = () => {
    if (!analyser) return;
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const v of buffer) sum += v * v;
    current = Math.min(1, Math.sqrt(sum / buffer.length) * 4);
    samples.push(current);
  };
  const timer = setInterval(measure, 100);

  const started = performance.now();
  // One piece, delivered at the end: iPhone can write broken MP4 files when
  // asked for the recording in small slices.
  try {
    recorder.start();
  } catch (error) {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    void audio?.close().catch(() => {});
    throw micError(error);
  }

  const release = () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    void audio?.close().catch(() => {});
  };

  return {
    level: () => current,
    elapsedMs: () => performance.now() - started,
    cancel: () => {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
    stop: () =>
      new Promise<Recording>((resolve, reject) => {
        const durationMs = Math.min(MAX_VOICE_MS, Math.round(performance.now() - started));
        recorder.onstop = () => {
          release();
          const type = recorder.mimeType || mimeType || chunks[0]?.type || "audio/mp4";
          const contentType = type.split(";")[0].trim();
          const blob = new Blob(chunks, { type: contentType });
          if (!blob.size) {
            reject(new RecorderError("Nothing was recorded. Try again."));
            return;
          }
          resolve({ blob, contentType, extension: extensionFor(contentType), durationMs, peaks: toPeaks(samples) });
        };
        if (recorder.state !== "inactive") recorder.stop();
        else recorder.onstop?.(new Event("stop"));
      }),
  };
}

/** "0:07", "1:24" */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
