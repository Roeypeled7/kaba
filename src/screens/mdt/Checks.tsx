import { useState } from 'react';
import type { UnitType, Vehicle } from '../../engine/model';
import { IcClipboard, IcTools, IcToolsCal } from './icons';
import { DAY, fmtDate, useLocal, type Ctx } from './shared';

type Kind = 'daily' | 'weekly' | 'semi';

export const CHECK_TITLE: Record<string, string> = {
  daily: 'בדיקה יומית',
  weekly: 'בדיקה שבועית',
  semi: 'בדיקה חצי שנתית',
  faults: 'תקלות פתוחות',
};

/** תדירות בימים */
const EVERY: Record<Kind, number> = { daily: 1, weekly: 7, semi: 182 };

interface Item {
  text: string;
  /** תקלה בפריט הזה משביתה את הרכב */
  critical?: boolean;
  /** רק לסוגי הרכב האלה (ברירת מחדל — כולם) */
  only?: UnitType[];
}

const WATER: UnitType[] = ['engine', 'tanker'];
const HEAVY: UnitType[] = ['engine', 'tanker', 'ladder'];

const ITEMS: Record<Kind, Item[]> = {
  daily: [
    { text: 'מפלס מים במיכל — מלא', only: WATER },
    { text: 'מפלס חומר קצף', only: WATER },
    { text: 'דלק — מעל 3/4' },
    { text: 'שמן מנוע ומי קירור' },
    { text: 'בלמים ובלם חניה', critical: true },
    { text: 'צמיגים — לחץ ובדיקה חזותית' },
    { text: 'אורות, פנסים ומהבהבים' },
    { text: 'סירנה וכריזה' },
    { text: 'מכשירי נשימה — לחץ בבלונים מעל 270 בר', only: HEAVY },
    { text: 'מכשירי קשר — טעונים ובמקום' },
    { text: 'מצלמה תרמית — טעונה', only: ['engine', 'commander'] },
    { text: 'משאבה — הפעלה קצרה ובדיקת לחץ', critical: true, only: WATER },
  ],
  weekly: [
    { text: 'גנרטור ותאורת זירה — הנעה', only: HEAVY },
    { text: 'מסור שרשרת ומסור דיסק — הנעה', only: ['engine', 'ladder'] },
    { text: 'מכשירי נשימה — בדיקת אטימות', only: HEAVY },
    { text: 'ספירת ציוד לפי רשימת תאים' },
    { text: 'זרנוקים — שלמות וקיפול', only: WATER },
    { text: 'מזנקים — ניקוי ובדיקת מצבים', only: WATER },
    { text: 'סולמות — נעילות ותקינות', only: ['engine', 'ladder'] },
    { text: 'מטפים — לחץ ותוקף' },
    { text: 'מצברים — מתח וחיבורים' },
    { text: 'מנוף — הרמה מלאה וייצוב', critical: true, only: ['ladder'] },
    { text: 'ניקוי תא הנהג והטאבלט' },
  ],
  semi: [
    { text: 'טיפול משאבה — שמן ואטמים', critical: true, only: WATER },
    { text: 'בדיקת לחץ לזרנוקים', only: WATER },
    { text: 'כיול גלאי גזים' },
    { text: 'מערכת קצף — יחס ערבוב', only: WATER },
    { text: 'בלמים — בדיקת מוסך', critical: true },
    { text: 'ציוד חילוץ הידראולי — טיפול', only: ['engine'] },
    { text: 'כריות הרמה — בדיקת לחץ', only: ['engine'] },
    { text: 'החלפת מסננים — אוויר ודלק' },
  ],
};

const itemsFor = (kind: Kind, v: Vehicle) => ITEMS[kind].filter((i) => !i.only || i.only.includes(v.type));

export interface Fault {
  id: string;
  text: string;
  critical: boolean;
  t: number;
  by: string;
  source: Kind | 'manual';
  closedAt?: number;
}

interface ChecksData {
  last: Partial<Record<Kind, { t: number; by: string }>>;
  faults: Fault[];
}

/** ערך התחלתי: שבועית באיחור, חצי-שנתית בתוקף, כמה תקלות פתוחות */
function seed(v: Vehicle, now: number): ChecksData {
  const seeded: [string, boolean][] =
    v.type === 'commander'
      ? [['מגב ימני שחוק', false]]
      : [
          ['פנס אחורי שמאלי לא דולק', false],
          ['דליפה קלה בזרנוק 2.5″ מס׳ 3', false],
          ['חסר מטף 6 ק״ג בתא 4', false],
          ['מושב נהג — מנגנון כיוון תקוע', false],
        ];
  return {
    last: { weekly: { t: now - 64 * DAY, by: 'משמרת קודמת' }, semi: { t: now - 99 * DAY, by: 'מוסך מחוזי' } },
    faults: seeded.map(([text, critical], i) => ({ id: `F${i + 1}`, text, critical, t: now - (i + 2) * 3 * DAY, by: 'משמרת קודמת', source: 'manual' })),
  };
}

export function useChecks(v: Vehicle, now: number) {
  const [data, set] = useLocal<ChecksData>(`kaba.mdt.checks.${v.id}`, () => seed(v, now));
  return { data, set };
}

/** ימים שנותרו עד הבדיקה הבאה (שלילי = באיחור) */
export function daysLeft(data: ChecksData, kind: Kind, now: number): number {
  const last = data.last[kind]?.t;
  if (last === undefined) return 0;
  return EVERY[kind] - Math.floor((now - last) / DAY);
}

/** יומית: בוצעה היום? (יום סימולציה) */
const doneToday = (data: ChecksData, now: number) => {
  const t = data.last.daily?.t;
  return t !== undefined && new Date(t).toDateString() === new Date(now).toDateString();
};

export const openFaults = (data: ChecksData) => data.faults.filter((f) => !f.closedAt);

/** תג על אריח "בדיקות רכב" במסך הבית */
export function checksBadge(data: ChecksData, now: number): { n: string; c: string } | null {
  const late = (['weekly', 'semi'] as const).filter((k) => daysLeft(data, k, now) < 0).length + (doneToday(data, now) ? 0 : 1);
  return late ? { n: String(late), c: 'red' } : null;
}

export default function Checks(ctx: Ctx) {
  const kind = ctx.segs[1];
  if (kind === 'daily' || kind === 'weekly' || kind === 'semi') return <Checklist ctx={ctx} kind={kind} />;
  if (kind === 'faults') return <Faults {...ctx} />;
  return <ChecksHome {...ctx} />;
}

function ChecksHome({ v, state, go }: Ctx) {
  const { data } = useChecks(v, state.simTime);
  const now = state.simTime;
  const badge = (n: number) => <span className={`mdt-badge ${n <= 0 ? 'red' : 'green'}`}>{n}</span>;
  const faults = openFaults(data).length;
  const tiles = [
    { k: 'daily', c: '#3ddc84', ic: <IcTools size={64} />, b: doneToday(data, now) ? null : <span className="mdt-badge red">!</span> },
    { k: 'weekly', c: '#ffb020', ic: <IcToolsCal size={64} star />, b: badge(daysLeft(data, 'weekly', now)) },
    { k: 'semi', c: '#ff7a1a', ic: <IcToolsCal size={64} />, b: badge(daysLeft(data, 'semi', now)) },
    { k: 'faults', c: '#ff3d2e', ic: <IcClipboard size={64} />, b: faults ? <span className="mdt-badge red">{faults}</span> : null },
  ];
  return (
    <div className="mdt-page">
      <div className="mdt-tiles big">
        {tiles.map((t) => (
          <button key={t.k} className="mdt-tile" style={{ '--tc': t.c } as React.CSSProperties} onClick={() => go(`checks/${t.k}`)}>
            {t.b}
            <span className="mdt-tile-ic">{t.ic}</span>
            <span className="mdt-tile-lbl">{CHECK_TITLE[t.k]}</span>
          </button>
        ))}
      </div>
      <div className="mdt-checks-meta">
        {(['daily', 'weekly', 'semi'] as const).map((k) => (
          <span key={k}>
            {CHECK_TITLE[k]}: {data.last[k] ? `${fmtDate(data.last[k]!.t)} · ${data.last[k]!.by}` : 'לא בוצעה'}
          </span>
        ))}
      </div>
    </div>
  );
}

type Answer = { ok: boolean; note: string };

function Checklist({ ctx, kind }: { ctx: Ctx; kind: Kind }) {
  const { v, state, send, go } = ctx;
  const { data, set } = useChecks(v, state.simTime);
  const items = itemsFor(kind, v);
  const [ans, setAns] = useState<Record<number, Answer>>({});
  const answered = Object.keys(ans).length;
  const by = v.crew.find((m) => m.role === 'commander')?.name ?? v.crewName ?? 'צוות';

  const save = () => {
    const now = state.simTime;
    const newFaults: Fault[] = items.flatMap((it, i) =>
      ans[i] && !ans[i].ok ? [{ id: `F${now}-${i}`, text: ans[i].note ? `${it.text} — ${ans[i].note}` : it.text, critical: !!it.critical, t: now, by, source: kind }] : [],
    );
    set((d) => ({ last: { ...d.last, [kind]: { t: now, by } }, faults: [...newFaults, ...d.faults] }));
    if (newFaults.some((f) => f.critical) && v.status === 'available') send({ type: 'vehicleAction', vehicleId: v.id, action: 'offline' });
    go('checks');
  };

  return (
    <div className="mdt-page">
      <section className="mdt-panel grow">
        <div className="mdt-panel-h">
          {CHECK_TITLE[kind]} · {v.callsign}
          <span className="mdt-panel-sub">בוצעה לאחרונה: {data.last[kind] ? fmtDate(data.last[kind]!.t) : '—'}</span>
        </div>
        <div className="mdt-scroll mdt-check-list">
          {items.map((it, i) => {
            const a = ans[i];
            return (
              <div key={it.text} className={`mdt-check ${a ? (a.ok ? 'ok' : 'bad') : ''}`}>
                <span className="mdt-check-n mono">{i + 1}</span>
                <span className="grow">
                  {it.text}
                  {it.critical && <span className="mdt-crit">משבית</span>}
                  {a && !a.ok && (
                    <input
                      className="mdt-check-note"
                      placeholder="פירוט התקלה (לא חובה)"
                      value={a.note}
                      onChange={(e) => setAns({ ...ans, [i]: { ok: false, note: e.target.value } })}
                    />
                  )}
                </span>
                <button className={`mdt-yn ok ${a?.ok ? 'on' : ''}`} onClick={() => setAns({ ...ans, [i]: { ok: true, note: '' } })}>
                  ✓ תקין
                </button>
                <button className={`mdt-yn bad ${a && !a.ok ? 'on' : ''}`} onClick={() => setAns({ ...ans, [i]: { ok: false, note: a?.note ?? '' } })}>
                  ✗ תקלה
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <div className="mdt-actions">
        <span className="mdt-progress">
          <i style={{ width: `${(answered / items.length) * 100}%` }} />
        </span>
        <span className="mono">
          {answered}/{items.length}
        </span>
        <button className="mdt-btn" onClick={() => setAns(Object.fromEntries(items.map((_, i) => [i, ans[i] ?? { ok: true, note: '' }])))}>
          סמן הכל תקין
        </button>
        <button className="mdt-btn cyan" disabled={answered < items.length} onClick={save}>
          סיום ושמירה
        </button>
      </div>
    </div>
  );
}

function Faults({ v, state, send }: Ctx) {
  const { data, set } = useChecks(v, state.simTime);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [critical, setCritical] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const by = v.crew.find((m) => m.role === 'commander')?.name ?? v.crewName ?? 'צוות';
  const list = data.faults.filter((f) => showClosed || !f.closedAt);

  const add = () => {
    if (!text.trim()) return;
    set((d) => ({ ...d, faults: [{ id: `F${state.simTime}`, text: text.trim(), critical, t: state.simTime, by, source: 'manual' }, ...d.faults] }));
    if (critical && v.status === 'available') send({ type: 'vehicleAction', vehicleId: v.id, action: 'offline' });
    setText('');
    setCritical(false);
    setAdding(false);
  };
  const close = (id: string) => {
    const next = data.faults.map((f) => (f.id === id ? { ...f, closedAt: state.simTime } : f));
    set({ ...data, faults: next });
    // נסגרה התקלה המשביתה האחרונה — הרכב חוזר לכשירות
    if (v.status === 'offline' && !next.some((f) => f.critical && !f.closedAt)) send({ type: 'vehicleAction', vehicleId: v.id, action: 'online' });
  };

  return (
    <div className="mdt-page">
      {v.status === 'offline' && <div className="mdt-banner red">הרכב מסומן לא כשיר במשל״ט. סגירת כל התקלות המשביתות תחזיר אותו לכשירות.</div>}
      <section className="mdt-panel grow">
        <div className="mdt-panel-h">
          תקלות ברכב {v.callsign}
          <label className="mdt-panel-sub mdt-check-inline">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> הצג סגורות
          </label>
        </div>
        <div className="mdt-scroll mdt-rows">
          {!list.length && <div className="mdt-empty">אין תקלות פתוחות</div>}
          {list.map((f) => (
            <div key={f.id} className={`mdt-row fault ${f.closedAt ? 'closed' : ''}`}>
              <span className={`mdt-fault-sev ${f.critical ? 'crit' : ''}`}>{f.critical ? 'משביתה' : 'לא משביתה'}</span>
              <span className="grow">
                <b>{f.text}</b>
                <span className="mdt-row-sub">
                  נפתחה {fmtDate(f.t)} · {f.by}
                  {f.source !== 'manual' && ` · מ${CHECK_TITLE[f.source]}`}
                  {f.closedAt && ` · נסגרה ${fmtDate(f.closedAt)}`}
                </span>
              </span>
              {!f.closedAt && (
                <button className="mdt-btn sm" onClick={() => close(f.id)}>
                  סגירת תקלה
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      {adding ? (
        <div className="mdt-actions">
          <input className="grow mdt-input" autoFocus placeholder="תיאור התקלה" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <label className="mdt-check-inline">
            <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} /> משביתה
          </label>
          <button className="mdt-btn" onClick={() => setAdding(false)}>
            ביטול
          </button>
          <button className="mdt-btn cyan" disabled={!text.trim()} onClick={add}>
            שמירה
          </button>
        </div>
      ) : (
        <div className="mdt-actions">
          <span className="grow" />
          <button className="mdt-btn cyan" onClick={() => setAdding(true)}>
            + דיווח תקלה
          </button>
        </div>
      )}
    </div>
  );
}
