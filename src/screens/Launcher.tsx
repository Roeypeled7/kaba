import { useState } from 'react';
import type { Command, SimState } from '../engine/model';
import type { ProfileId } from '../components/ui';
import { PROFILES, PROFILE_IDS, STATION_ACCENT, SimControls, TopBar, mainStations, routeHref, stationShort, subStations } from '../components/ui';

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
  /** מסך תחנה בתצוגה נפתח לפי שתי התחנות שנבחרו; שאר המסכים — אחד לכל מסך */
  const screenHrefs = (pid: ProfileId) =>
    PROFILES[pid].screens.flatMap((s) =>
      s.path.startsWith('/station/') ? [...new Set(pick)].map((id) => routeHref(pid, `/station/${id}`)) : [routeHref(pid, s.path)],
    );
  const openProfile = (pid: ProfileId) => screenHrefs(pid).forEach((h, i) => openWin(h, i));
  const stationPath = (path: string) => (path.startsWith('/station/') ? `/station/${pick[0]}` : path);
  const pickers = (
    <>
      <span className="dim small">תחנות:</span>
      {([0, 1] as const).map((i) => (
        <select key={i} value={pick[i]} onChange={(e) => setOne(i, +e.target.value)}>
          {mains.map((s) => (
            <option key={s.id} value={s.id}>
              {stationShort(s)}
            </option>
          ))}
        </select>
      ))}
    </>
  );

  return (
    <div className="screen launcher">
      <TopBar state={state} title="משל״ט מחוזי — הדמיה" />
      <main className="launch-main">
        <p className="lead">
          עמדות שמחוברות למנוע הדמיה אחד. פתח כל עמדה בחלון נפרד (או על מסך נפרד) — כל פעולה בעמדה אחת מופיעה מיד בכל השאר.
        </p>
        {!shared && <div className="warn">הדפדפן הזה לא תומך ב-SharedWorker — כל חלון ירוץ בנפרד, בלי סנכרון. מומלץ Chrome / Edge / Safari 16+.</div>}

        {PROFILE_IDS.map((pid, pi) => {
          const p = PROFILES[pid];
          const hasStations = p.screens.some((s) => s.path.startsWith('/station/'));
          return (
            <section key={pid} className="profile" style={{ '--accent': p.accent } as React.CSSProperties}>
              <div className="profile-head">
                <div className="lc-num">{pi + 1}</div>
                <div>
                  <h2>{p.title}</h2>
                  <p>{p.desc}</p>
                </div>
                <div className="profile-open">
                  {hasStations && pickers}
                  <button className="btn fire" onClick={() => openProfile(pid)}>
                    פתח את כל המסכים ({screenHrefs(pid).length})
                  </button>
                </div>
              </div>
              <div className="launch-grid">
                {p.screens.map((s, i) => {
                  const href = routeHref(pid, stationPath(s.path));
                  return (
                    <div key={s.path} className="launch-card">
                      <h2>{s.title}</h2>
                      <p>{s.desc}</p>
                      <div className="row gap">
                        <button className="btn primary" onClick={() => openWin(href, i)}>
                          פתח בחלון
                        </button>
                        <a className="btn ghost" href={href}>
                          כאן
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="station-launch">
          <h2>עמדות תחנה · {PROFILES.ops.title}</h2>
          <div className="station-launch-grid">
            {mains.map((st, i) => (
              <div key={st.id} className="sl-card" style={{ '--accent': STATION_ACCENT[st.id] } as React.CSSProperties}>
                <button className="sl-open" onClick={() => openWin(routeHref('ops', `/station/${st.id}`), i)} title="פתח בחלון">
                  <span className="sl-num mono">{st.id}</span>
                  <span className="sl-name">{stationShort(st)}</span>
                  <span className="sl-subs">
                    {subStations(state.stations, st.id)
                      .map((s) => stationShort(s))
                      .join(' · ') || 'ללא תחנות משנה'}
                  </span>
                </button>
                <a className="sl-here" href={routeHref('ops', `/station/${st.id}`)}>
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
