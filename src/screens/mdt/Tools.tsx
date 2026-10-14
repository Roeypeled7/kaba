import { useState } from 'react';
import { fmtHM } from '../../components/ui';
import { useLocal, type Ctx } from './shared';

type Tab = 'ba' | 'water' | 'phones';
const TABS: [Tab, string][] = [
  ['ba', 'בקרת נשימה'],
  ['water', 'מחשבון מים וקצף'],
  ['phones', 'טלפונים חיוניים'],
];

export default function Tools(ctx: Ctx) {
  const [tab, setTab] = useState<Tab>('ba');
  return (
    <div className="mdt-page">
      <div className="mdt-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'ba' ? <BreathingControl {...ctx} /> : tab === 'water' ? <Water {...ctx} /> : <Phones />}
    </div>
  );
}

/* ── בקרת כניסה במכשירי נשימה ── */

const CYL_L = 6.8; // נפח בלון בליטרים
const USE_LPM = 40; // צריכה ממוצעת בעבודה
const WHISTLE_BAR = 55; // לחץ שבו נשמעת שריקת אזהרה

interface Wearer {
  id: number;
  name: string;
  bar: number;
  inAt: number;
}

const whistleMin = (bar: number) => ((bar - WHISTLE_BAR) * CYL_L) / USE_LPM;

function BreathingControl({ v, state }: Ctx) {
  const [list, setList] = useLocal<Wearer[]>(`kaba.mdt.ba.${v.id}`, () => []);
  const [name, setName] = useState(v.crew.find((m) => m.role !== 'driver')?.name ?? '');
  const [bar, setBar] = useState(300);
  const inside = new Set(list.map((w) => w.name));
  const enter = () => {
    if (!name || inside.has(name)) return;
    setList([...list, { id: state.simTime, name, bar, inAt: state.simTime }]);
    setName(v.crew.find((m) => !inside.has(m.name) && m.name !== name && m.role !== 'driver')?.name ?? '');
  };

  return (
    <div className="mdt-split">
      <section className="mdt-panel side">
        <div className="mdt-panel-h">כניסה למבנה</div>
        <div className="mdt-form">
          <label>
            לובש המכשיר
            <select className="mdt-input dark" value={name} onChange={(e) => setName(e.target.value)}>
              <option value="">— בחרו —</option>
              {v.crew.map((m) => (
                <option key={m.name} value={m.name} disabled={inside.has(m.name)}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            לחץ בבלון (בר)
            <input className="mdt-input dark mono" type="number" min={100} max={300} step={10} value={bar} onChange={(e) => setBar(+e.target.value)} />
          </label>
          <div className="mdt-calc">
            <span>
              זמן עבודה עד שריקה: <b className="mono">{Math.max(0, Math.floor(whistleMin(bar)))}</b> דק׳
            </span>
            <span className="dim small">
              בלון {CYL_L} ל׳ · צריכה {USE_LPM} ל׳/דק׳ · שריקה ב-{WHISTLE_BAR} בר
            </span>
          </div>
          <button className="mdt-btn cyan big" disabled={!name || inside.has(name) || bar <= WHISTLE_BAR} onClick={enter}>
            רישום כניסה
          </button>
        </div>
      </section>
      <section className="mdt-panel grow">
        <div className="mdt-panel-h">לוח בקרה — {list.length} בפנים</div>
        <div className="mdt-scroll mdt-rows">
          {!list.length && <div className="mdt-empty">אין לובשי מכשירים בפנים</div>}
          {list.map((w) => {
            const total = whistleMin(w.bar);
            const used = (state.simTime - w.inAt) / 60000;
            const left = total - used;
            const frac = Math.max(0, left / total);
            return (
              <div key={w.id} className={`mdt-row ba ${left <= 0 ? 'alarm' : left < 5 ? 'warn' : ''}`}>
                <span className="grow">
                  <b>{w.name}</b>
                  <span className="mdt-row-sub">
                    נכנס {fmtHM(w.inAt)} · {w.bar} בר · שריקה צפויה {fmtHM(w.inAt + total * 60000)}
                  </span>
                  <span className="mdt-progress">
                    <i style={{ width: `${frac * 100}%` }} />
                  </span>
                </span>
                <span className="mdt-ba-left mono">{left > 0 ? `${Math.floor(left)}:${String(Math.floor((left % 1) * 60)).padStart(2, '0')}` : 'צא!'}</span>
                <button className="mdt-btn sm" onClick={() => setList(list.filter((x) => x.id !== w.id))}>
                  יצא
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ── מחשבון מים וקצף ── */

const TANK_L: Record<string, number> = { engine: 4000, tanker: 12000, ladder: 0, commander: 0 };

function Water({ v }: Ctx) {
  const [tank, setTank] = useState(TANK_L[v.type] || 4000);
  const [lines, setLines] = useState(2);
  const [flow, setFlow] = useState(400);
  const [foamPct, setFoamPct] = useState(3);
  const total = lines * flow;
  const minutes = total ? tank / total : 0;
  const foam = (total * 10 * foamPct) / 100;

  return (
    <div className="mdt-split">
      <section className="mdt-panel side">
        <div className="mdt-panel-h">נתונים</div>
        <div className="mdt-form">
          <label>
            מים במיכל (ל׳)
            <input className="mdt-input dark mono" type="number" min={0} step={500} value={tank} onChange={(e) => setTank(+e.target.value)} />
          </label>
          <label>
            מספר קווים פעילים
            <div className="mdt-seg">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} className={lines === n ? 'on' : ''} onClick={() => setLines(n)}>
                  {n}
                </button>
              ))}
            </div>
          </label>
          <label>
            ספיקה לקו (ל׳/דק׳)
            <div className="mdt-seg">
              {[125, 250, 400, 750].map((n) => (
                <button key={n} className={flow === n ? 'on' : ''} onClick={() => setFlow(n)}>
                  {n}
                </button>
              ))}
            </div>
          </label>
          <label>
            ריכוז קצף
            <div className="mdt-seg">
              {[1, 3, 6].map((n) => (
                <button key={n} className={foamPct === n ? 'on' : ''} onClick={() => setFoamPct(n)}>
                  {n}%
                </button>
              ))}
            </div>
          </label>
        </div>
      </section>
      <section className="mdt-panel grow mdt-water">
        <div className="mdt-big-num">
          <b className="mono">{minutes >= 1 ? Math.floor(minutes) : minutes.toFixed(1)}</b>
          <span>דקות עבודה מהמיכל</span>
        </div>
        <div className="mdt-hz-grid">
          <div>
            <span>ספיקה כוללת</span>
            <b className="mono">{total} ל׳/דק׳</b>
          </div>
          <div>
            <span>תרכיז קצף ל-10 דק׳</span>
            <b className="mono">{Math.round(foam)} ל׳</b>
          </div>
          <div>
            <span>מים לשעה</span>
            <b className="mono">{(total * 60).toLocaleString('he-IL')} ל׳</b>
          </div>
          <div className={minutes < 5 ? 'hot' : ''}>
            <span>המלצה</span>
            <b>{minutes < 5 ? 'לחבר הזנה / להזמין אשד' : 'מספיק להתקפה ראשונה'}</b>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── טלפונים ── */

const PHONES: [string, string][] = [
  ['כבאות והצלה', '102'],
  ['מד״א', '101'],
  ['משטרה', '100'],
  ['חברת החשמל — תקלות', '103'],
  ['מוקד עירוני', '106'],
  ['מוקד חומ״ס מחוזי (הדמיה)', '*4400'],
  ['משל״ט מחוזי (הדמיה)', '*4410'],
];

function Phones() {
  return (
    <section className="mdt-panel grow">
      <div className="mdt-scroll mdt-rows">
        {PHONES.map(([n, p]) => (
          <div key={n} className="mdt-row phone">
            <span className="grow">{n}</span>
            <b className="mono">{p}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
