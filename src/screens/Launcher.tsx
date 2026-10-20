import { useState } from 'react';
import type { Command, SimState } from '../engine/model';
import { STATION_ACCENT, SimControls, TopBar, mainStations, stationShort, subStations } from '../components/ui';

const CORE = [
  { hash: '#/dispatch', title: 'קבלה ושיגור', desc: 'שיחות נכנסות, פתיחת אירוע, הזנקה אוטומטית, ניהול אירועים ולוח כוחות' },
  { hash: '#/comms', title: 'מערכת קשר', desc: 'ערוצי קשר, תעבורה לפי אירוע, שידור ליחידות, תיאום מד״א ומשטרה' },
  { hash: '#/map', title: 'מפה', desc: 'מפת מצב חיה — תחנות, רכבים בתנועה, אירועים, אמבולנסים ובתי חולים' },
];

/** הטאבלט הוא עמוד נפרד (tablet/) — אותו מנוע, קישור משלו */
const TABLET_URL = 'tablet/';

const PICK_KEY = 'kaba.launcher.stations';
const DEFAULT_PICK: [number, number] = [1, 4];

function loadPick(): [number, number] {
  try {
    const raw = localStorage.getItem(PICK_KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n))) return [v[0], v[1]];
  } catch {
    /* אחסון חסום — ברירת מחדל */
  }
  return DEFAULT_PICK;
}

function savePick(p: [number, number]) {
  try {
    localStorage.setItem(PICK_KEY, JSON.stringify(p));
  } catch {
    /* אחסון חסום — לא נורא */
  }
}

const openWin = (hash: string, i: number) =>
  window.open(`${location.pathname}${hash}`, `kaba-${hash}`, `width=1280,height=800,left=${40 + i * 40},top=${40 + i * 30}`);

export default function Launcher({ state, send, shared }: { state: SimState; send: (c: Command) => void; shared: boolean }) {
  const mains = mainStations(state.stations);
  const [pick, setPick] = useState<[number, number]>(loadPick);
  const setOne = (i: 0 | 1, id: number) => {
    const next: [number, number] = i === 0 ? [id, pick[1]] : [pick[0], id];
    setPick(next);
    savePick(next);
  };
  const openAll = () => {
    const hashes = [...CORE.map((c) => c.hash), ...[...new Set(pick)].map((id) => `#/station/${id}`)];
    hashes.forEach((h, i) => openWin(h, i));
  };

  return (
    <div className="screen launcher">
      <TopBar state={state} title="משל״ט מחוזי — הדמיה" />
      <main className="launch-main">
        <p className="lead">
          עמדות שמחוברות למנוע הדמיה אחד. פתח כל עמדה בחלון נפרד (או על מסך נפרד) — כל פעולה בעמדה אחת מופיעה מיד בכל השאר.
        </p>
        {!shared && <div className="warn">הדפדפן הזה לא תומך ב-SharedWorker — כל חלון ירוץ בנפרד, בלי סנכרון. מומלץ Chrome / Edge / Safari 16+.</div>}

        <div className="launch-grid">
          {CORE.map((s, i) => (
            <div key={s.hash} className="launch-card">
              <div className="lc-num">{i + 1}</div>
              <h2>{s.title}</h2>
              <p>{s.desc}</p>
              <div className="row gap">
                <button className="btn primary" onClick={() => openWin(s.hash, i)}>
                  פתח בחלון
                </button>
                <a className="btn ghost" href={s.hash}>
                  כאן
                </a>
              </div>
            </div>
          ))}
        </div>

        <section className="station-launch">
          <h2>עמדות תחנה</h2>
          <div className="station-launch-grid">
            {mains.map((st, i) => (
              <div key={st.id} className="sl-card" style={{ '--accent': STATION_ACCENT[st.id] } as React.CSSProperties}>
                <button className="sl-open" onClick={() => openWin(`#/station/${st.id}`, CORE.length + i)} title="פתח בחלון">
                  <span className="sl-num mono">{st.id}</span>
                  <span className="sl-name">{stationShort(st)}</span>
                  <span className="sl-subs">
                    {subStations(state.stations, st.id)
                      .map((s) => stationShort(s))
                      .join(' · ') || 'ללא תחנות משנה'}
                  </span>
                </button>
                <a className="sl-here" href={`#/station/${st.id}`}>
                  כאן
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="station-launch">
          <h2>טאבלט רכב</h2>
          <div className="launch-card tablet-card">
            <div>
              <h2>המסך שבתא הנהג</h2>
              <p>הזנקות וסטטוסים, צוות ברכב, בדיקות רכב, צימוד קשר, חומ״ס, שערים וכלי עזר. עמוד נפרד עם קישור משלו — מסונכרן לאותה הדמיה.</p>
            </div>
            <div className="row gap">
              <button className="btn primary" onClick={() => window.open(TABLET_URL, 'kaba-tablet', 'width=1372,height=900,left=80,top=60')}>
                פתח בחלון
              </button>
              <a className="btn ghost" href={TABLET_URL}>
                כאן
              </a>
            </div>
          </div>
        </section>

        <div className="open-all">
          <button className="btn fire big" onClick={openAll}>
            פתח את כל העמדות
          </button>
          <span className="dim small">שיגור, קשר, מפה ושתי תחנות:</span>
          {([0, 1] as const).map((i) => (
            <select key={i} value={pick[i]} onChange={(e) => setOne(i, +e.target.value)}>
              {mains.map((s) => (
                <option key={s.id} value={s.id}>
                  {stationShort(s)}
                </option>
              ))}
            </select>
          ))}
          <span className="dim small">אם נפתח רק חלון אחד — אשר חלונות קופצים לאתר בשורת הכתובת.</span>
        </div>

        <section className="panel">
          <h2>בקרת הדמיה</h2>
          <SimControls state={state} send={send} />
          <div className="row gap" style={{ marginTop: 12 }}>
            <button className="btn danger sm" onClick={() => confirm('לאפס את כל ההדמיה?') && send({ type: 'reset' })}>
              איפוס הדמיה
            </button>
            <span className="dim small">
              {state.incidents.filter((i) => i.status !== 'closed').length} אירועים פעילים · {state.vehicles.filter((v) => v.status !== 'available').length} רכבים לא בתחנה
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
