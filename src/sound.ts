import { useEffect, useRef, useState } from 'react';

let ctx: AudioContext | null = null;
const subs = new Set<() => void>();

export function audioReady(): boolean {
  return ctx?.state === 'running';
}

export async function unlockAudio() {
  ctx ??= new AudioContext();
  await ctx.resume();
  subs.forEach((f) => f());
}

export function useAudioReady(): boolean {
  const [ready, setReady] = useState(audioReady());
  useEffect(() => {
    const f = () => setReady(audioReady());
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return ready;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.08) {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.setValueAtTime(gain, t0 + dur - 0.02);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** צפצוף הזנקה — דו־טוני */
export function playAlarm() {
  for (let i = 0; i < 4; i++) {
    tone(960, i * 0.5, 0.24);
    tone(720, i * 0.5 + 0.25, 0.24);
  }
}

/** צלצול טלפון */
export function playRing() {
  for (const s of [0, 0.5]) {
    tone(440, s, 0.4, 'sine', 0.1);
    tone(480, s, 0.4, 'sine', 0.1);
  }
}

/** סקוולץ׳ של קשר */
export function playBlip() {
  tone(1400, 0, 0.05, 'square', 0.04);
  tone(900, 0.06, 0.05, 'square', 0.04);
}

/** מנגן בלולאה כל עוד active */
export function useSoundLoop(active: boolean, play: () => void, everyMs: number) {
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    if (!active) return;
    playRef.current();
    const id = setInterval(() => playRef.current(), everyMs);
    return () => clearInterval(id);
  }, [active, everyMs]);
}
