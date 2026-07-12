/**
 * Lightweight WebAudio beeps — no asset files, works mobile after first gesture.
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const C =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  durationMs: number,
  type: OscillatorType = "square",
  gain = 0.08,
  when = 0,
) {
  const audio = ac();
  if (!audio) return;
  const t0 = audio.currentTime + when;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

/** Unlock audio on first user tap (iOS) */
export function unlockAudio() {
  const audio = ac();
  if (!audio) return;
  void audio.resume();
  // tiny silent blip
  tone(40, 10, "sine", 0.0001);
}

/** Big countdown: 3, 2, 1 — descending pitch */
export function playCountdownBeep(n: 3 | 2 | 1) {
  const freq = n === 3 ? 440 : n === 2 ? 520 : 620;
  tone(freq, 160, "square", 0.1);
}

/** GO flash */
export function playGoBeep() {
  tone(880, 90, "square", 0.12);
  tone(1175, 120, "square", 0.08, 0.08);
}

/** Soft hit tick */
export function playHitBeep() {
  tone(220, 40, "triangle", 0.06);
}

/** Settle success */
export function playSettleBeep() {
  tone(523, 80, "sine", 0.07);
  tone(659, 100, "sine", 0.06, 0.09);
  tone(784, 140, "sine", 0.05, 0.18);
}
