import type { Command, SimState } from '../engine/model';
import { SCREENS, SimControls, TopBar } from '../components/ui';

const DESC: Record<string, string> = {
  '#/dispatch': 'שיחות נכנסות, פתיחת אירוע, הזנקה אוטומטית, ניהול אירועים ולוח כוחות',
  '#/comms': 'ערוצי קשר, תעבורה לפי אירוע, שידור ליחידות, תיאום מד״א ומשטרה',
  '#/station/1': 'לוח תחנת כפר סבא — התראת הזנקה, צוות בתור, רכבים וסטטוסים',
  '#/station/2': 'לוח תחנת רעננה — התראת הזנקה, צוות בתור, רכבים וסטטוסים',
  '#/map': 'מפת מצב חיה — תחנות, רכבים בתנועה, אירועים ואמבולנסים',
};

const openWin = (hash: string, i: number) =>
  window.open(`${location.pathname}${hash}`, `kaba-${hash}`, `width=1280,height=800,left=${40 + i * 40},top=${40 + i * 30}`);

export default function Launcher({ state, send, shared }: { state: SimState; send: (c: Command) => void; shared: boolean }) {
  return (
    <div className="screen launcher">
      <TopBar state={state} title="משל״ט מחוזי — הדמיה" />
      <main className="launch-main">
        <p className="lead">
          חמש עמדות שמחוברות למנוע הדמיה אחד. פתח כל עמדה בחלון נפרד (או על מסך נפרד) — כל פעולה בעמדה אחת מופיעה מיד בכל השאר.
        </p>
        {!shared && <div className="warn">הדפדפן הזה לא תומך ב-SharedWorker — כל חלון ירוץ בנפרד, בלי סנכרון. מומלץ Chrome / Edge / Safari 16+.</div>}
        <div className="launch-grid">
          {SCREENS.map((s, i) => (
            <div key={s.hash} className="launch-card">
              <div className="lc-num">{i + 1}</div>
              <h2>{s.title}</h2>
              <p>{DESC[s.hash]}</p>
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
        <div className="row gap">
          <button className="btn fire big" onClick={() => SCREENS.forEach((s, i) => openWin(s.hash, i))}>
            פתח את כל העמדות
          </button>
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
