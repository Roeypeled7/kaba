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

/** סירנת כבאית — יללה עולה-יורדת (wail), שני מחזורים */
export function playSiren(cycles = 2, cycleSec = 1.6) {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  const total = cycles * cycleSec;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.09, t0 + 0.15);
  g.gain.setValueAtTime(0.09, t0 + total - 0.25);
  g.gain.linearRampToValueAtTime(0, t0 + total);
  // גוף הצליל: סינוס + מעט מסור לעוקצנות, דרך מסנן נמוך
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  lp.connect(g).connect(ctx.destination);
  for (const [type, gain] of [['sine', 1], ['sawtooth', 0.18]] as [OscillatorType, number][]) {
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    og.gain.value = gain;
    osc.type = type;
    osc.frequency.setValueAtTime(620, t0);
    for (let i = 0; i < cycles; i++) {
      const a = t0 + i * cycleSec;
      osc.frequency.exponentialRampToValueAtTime(1250, a + cycleSec / 2);
      osc.frequency.exponentialRampToValueAtTime(620, a + cycleSec);
    }
    osc.connect(og).connect(lp);
    osc.start(t0);
    osc.stop(t0 + total + 0.05);
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
