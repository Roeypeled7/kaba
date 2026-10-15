import { useCallback, useState } from 'react';
import type { Command, SimState, Station, Vehicle } from '../../engine/model';

export type Send = (c: Command) => void;

/** מה שכל מסך בטאבלט מקבל */
export interface Ctx {
  state: SimState;
  send: Send;
  v: Vehicle;
  st: Station;
  /** תת-נתיב בתוך המסך: ['checks', 'daily'] */
  segs: string[];
  /** ניווט בתוך הטאבלט של אותו רכב: go('checks/daily'), go('') למסך הבית */
  go: (sub: string) => void;
}

export const DAY = 86_400_000;

/** מצב מקומי של הטאבלט (בדיקות, צימודים) — נשמר בדפדפן, ועובד גם כשהאחסון חסום */
export function useLocal<T>(key: string, init: () => T): [T, (next: T | ((prev: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* אחסון חסום — ערך התחלתי */
    }
    return init();
  });
  const set = useCallback(
    (next: T | ((prev: T) => T)) =>
      setVal((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* לא נשמר — ממשיכים בזיכרון */
        }
        return v;
      }),
    [key],
  );
  return [val, set];
}

export const fmtDate = (t: number) =>
  new Date(t).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

/** שם פרטי / שם משפחה — לשתי שורות באריח */
export function splitName(name: string): [string, string] {
  const i = name.indexOf(' ');
  return i < 0 ? [name, ''] : [name.slice(0, i), name.slice(i + 1)];
}

/** גוון קבוע לכל שם — בתחום צר של פלדה כחלחלה, כדי לא להוסיף צבעים לערכה */
function hue(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 40;
  return 200 + h;
}

/** "תמונת פספורט" — ראשי תיבות על רקע קבוע לכל שם */
export function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const [a, b] = splitName(name);
  return (
    <span className="mdt-avatar" style={{ width: size * 0.82, height: size, '--h': hue(name), fontSize: size * 0.34 } as React.CSSProperties}>
      {a[0]}
      {b[0] ?? ''}
    </span>
  );
}

/** כל האנשים של תחנה: צוותים, שיבוצים ברכבים, כוח אדם פנוי ותוספות מהטאבלט */
export function stationPeople(state: SimState, st: Station, extra: string[] = []): string[] {
  const names = new Set<string>();
  for (const tid of st.teamOrder) {
    const t = st.teams[tid];
    if (!t) continue;
    names.add(t.leader);
    t.crew.forEach((n) => names.add(n));
  }
  st.reserve.forEach((n) => names.add(n));
  state.vehicles.filter((x) => x.stationId === st.id).forEach((x) => x.crew.forEach((m) => names.add(m.name)));
  extra.forEach((n) => names.add(n));
  return [...names];
}

/** הודעות הקשר של הרכב — ממנו, אליו, או על האירוע שלו */
export function unitFeed(state: SimState, v: Vehicle, limit = 6) {
  return state.radio.filter((m) => m.from === v.callsign || m.to === v.callsign || (v.incidentId && m.incidentId === v.incidentId && m.channel !== 'district')).slice(-limit).reverse();
}
