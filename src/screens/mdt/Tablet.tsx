import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { STATUS_LABEL, TABLET_TIMING } from '../../engine/config';
import type { SimState, Vehicle } from '../../engine/model';
import { fmtHM, mainStations, stationShort, subStations, byUnit } from '../../components/ui';
import { BASE, TABLET_ROOT, navigate } from '../../router';
import { audioReady, unlockAudio } from '../../sound';
import { IcBack, IcBarrier, IcBattery, IcFlame, IcHazard, IcHelmet, IcHome, IcHydrant, IcMenu, IcWrenchCheck, Watermark } from './icons';
import { useLocal, type Ctx, type Send } from './shared';
import AlarmOverlay from './Alarm';
import Events from './Events';
import Crew from './Crew';
import Checks, { CHECK_TITLE, useChecks, checksBadge } from './Checks';
import Hazmat from './Hazmat';
import Gates from './Gates';
import Tools from './Tools';
import './mdt.css';

export const MDT_VERSION = '1.7.4';
const W = 1280;
const H = 800;
const BEZEL_X = 46;
const BEZEL_Y = 42;

/**
 * צבע האריח — שלושה צבעים בלבד: אדום-אש למבצעי, ענבר לצוות וציוד, פלדה לכלים.
 * הדאשבורד מוסתר זמנית — המסך עצמו נשאר ב-./Dashboard.tsx (אייקון IcGauge). כדי להחזיר: שורה כאן + 'dashboard' ב-HOME_ORDER.
 */
const PAGES: Record<string, { title: string; color: string; Icon: (p: { size?: number }) => JSX.Element; Comp: (c: Ctx) => JSX.Element }> = {
  events: { title: 'אירועים', color: '#ff3d2e', Icon: IcFlame, Comp: Events },
  crew: { title: 'צוות ברכב', color: '#ffb020', Icon: IcHelmet, Comp: Crew },
  checks: { title: 'בדיקות רכב', color: '#ffb020', Icon: IcWrenchCheck, Comp: Checks },
  hazmat: { title: 'חומ״ס', color: '#ff3d2e', Icon: IcHazard, Comp: Hazmat },
  gates: { title: 'פתיחת שערים', color: '#c9d3de', Icon: IcBarrier, Comp: Gates },
  tools: { title: 'כלי עזר', color: '#ffb020', Icon: IcHydrant, Comp: Tools },
};
/** שישה אריחים — שלושה בשורה, שתי שורות */
const HOME_ORDER = ['events', 'crew', 'checks', 'hazmat', 'gates', 'tools'];

/** מקטין/מגדיל את מסך ה-1280×800 כך שייכנס לחלון */
function useFit(w: number, h: number, pad: number) {
  const [s, setS] = useState(1);
  useLayoutEffect(() => {
    const f = () => setS(Math.min((window.innerWidth - pad) / w, (window.innerHeight - pad) / h));
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [w, h, pad]);
  return s;
}

type Frame = 'bezel' | 'full';

export default function Tablet({ state, send, path }: { state: SimState; send: Send; path: string[] }) {
  const [vid, ...segs] = path;
  const v = vid ? state.vehicles.find((x) => x.id === decodeURIComponent(vid)) : undefined;
  const st = v && state.stations.find((s) => s.id === v.stationId);
  const [frame, setFrame] = useLocal<Frame>('kaba.mdt.frame', () => 'bezel');
  const bezel = frame === 'bezel';
  const scale = useFit(bezel ? W + 2 * BEZEL_X : W, bezel ? H + 2 * BEZEL_Y : H, bezel ? 24 : 0);
  const [drawer, setDrawer] = useState(false);

  const base = v ? `${TABLET_ROOT}${encodeURIComponent(v.id)}` : TABLET_ROOT;
  const go = (sub: string) => {
    setDrawer(false);
    navigate(sub ? `${base}/${sub}` : base);
  };

  const page = segs[0] ? PAGES[segs[0]] : undefined;
  const subTitle = !v ? 'בחירת רכב' : !page ? 'מסך הבית' : segs[0] === 'checks' && segs[1] ? CHECK_TITLE[segs[1]] ?? page.title : page.title;
  const back = () => (!v ? (location.href = BASE) : segs.length > 1 ? go(segs.slice(0, -1).join('/')) : segs.length ? go('') : navigate(TABLET_ROOT));

  // ההזנקה של הרכב הזה, כל עוד הצוות שלו לא ראה אותה. כל טאבלט סוגר את החלון לעצמו —
  // אישור בעמדת התחנה או בטאבלט של רכב אחר לא מעלים אותו מכאן
  const alarm =
    v && v.status === 'dispatched' ? state.dispatches.find((d) => d.incidentId === v.incidentId && d.vehicleIds.includes(v.id) && !d.seenBy?.includes(v.id)) : undefined;
  // רכב עם אירוע פעיל נפתח ישר על מסך האירוע (ניווט + פרטים): כשהאירוע מגיע, וגם כשפותחים את הטאבלט במסך הבית באמצע אירוע
  const incidentId = v?.incidentId ?? null;
  const prevIncident = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const first = prevIncident.current === undefined;
    const changed = prevIncident.current !== incidentId;
    prevIncident.current = incidentId;
    if (incidentId && segs[0] !== 'events' && (first ? segs.length === 0 : changed)) go('events');
  }, [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // כל עוד הטאבלט פתוח הרכב לא יוצא ולא מגיע לבד — הצוות מדווח "יצאנו" ו"במקום"
  const vehicleId = v?.id;
  useEffect(() => {
    if (!vehicleId) return;
    const beat = () => send({ type: 'tabletBeat', vehicleId });
    beat();
    const id = setInterval(beat, TABLET_TIMING.beatMs);
    return () => clearInterval(id);
  }, [vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx: Ctx | null = v && st ? { state, send, v, st, segs, go } : null;

  return (
    <div className="mdt-stage">
      <div
        className={`mdt-device ${frame}`}
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        onPointerDown={() => !audioReady() && unlockAudio()}
      >
        {bezel && (
          <>
            <div className="mdt-mount" />
            <div className="mdt-cams">
              <i />
              <i />
            </div>
            <div className="mdt-brand">RUGGED · MDT</div>
          </>
        )}
        <div className="mdt mdt-screen">
          <header className="mdt-bar">
            <div className="mdt-bar-r">
              <span className="mono">{fmtHM(state.simTime)}</span>
              <IcBattery />
              {v && <span className={`mdt-stdot st-${v.status}`}>{STATUS_LABEL[v.status]}</span>}
            </div>
            <div className="mdt-bar-title">{v && st ? `${stationShort(st)} ${v.unit}` : 'טאבלט רכב'}</div>
            <div className="mdt-bar-l">
              <button className="mdt-iconbtn" onClick={() => (v ? go('') : navigate(TABLET_ROOT))} aria-label="מסך הבית">
                <IcHome />
              </button>
              <button className="mdt-iconbtn" onClick={() => setDrawer(true)} aria-label="תפריט">
                <IcMenu />
              </button>
            </div>
          </header>
          <div className="mdt-sub">
            <button className="mdt-iconbtn" onClick={back} aria-label="חזרה">
              {(v ? segs.length > 0 : true) && <IcBack />}
            </button>
            <div>{subTitle}</div>
            <span />
          </div>

          <main className="mdt-body">
            <div className="mdt-watermark">
              <Watermark />
            </div>
            {!ctx ? <Picker state={state} /> : page ? <page.Comp {...ctx} /> : <Home {...ctx} />}
          </main>

          {ctx && alarm && <AlarmOverlay ctx={ctx} dispatchIds={[alarm.id]} />}

          {drawer && (
            <>
              <div className="mdt-scrim" onClick={() => setDrawer(false)} />
              <nav className="mdt-drawer">
                <div className="mdt-drawer-h">
                  <b>{v && st ? `${stationShort(st)} ${v.unit}` : 'טאבלט רכב'}</b>
                  <span className="dim">{v?.crewName ?? ''}</span>
                </div>
                {v && (
                  <>
                    <button onClick={() => go('')}>
                      <IcHome size={20} /> מסך הבית
                    </button>
                    {HOME_ORDER.map((k) => {
                      const P = PAGES[k];
                      return (
                        <button key={k} style={{ '--tc': P.color } as React.CSSProperties} onClick={() => go(k)}>
                          <P.Icon size={20} /> {P.title}
                        </button>
                      );
                    })}
                    <hr />
                  </>
                )}
                <button onClick={() => (navigate(TABLET_ROOT), setDrawer(false))}>⇄ החלפת רכב</button>
                <button onClick={() => (setFrame(bezel ? 'full' : 'bezel'), setDrawer(false))}>{bezel ? '⛶ מסך מלא' : '▭ תצוגת טאבלט'}</button>
                <button onClick={() => (location.href = BASE)}>↩ למשל״ט</button>
                <div className="mdt-drawer-f">גרסה {MDT_VERSION} · מחובר להדמיה</div>
              </nav>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Home(ctx: Ctx) {
  const checks = useChecks(ctx.v, ctx.state.simTime);
  const activeInc = ctx.v.incidentId ? 1 : 0;
  return (
    <div className="mdt-page">
      <span className="mdt-version mono">{MDT_VERSION}</span>
      <div className="mdt-tiles">
        {HOME_ORDER.map((k) => {
          const P = PAGES[k];
          const badge = k === 'events' && activeInc ? { n: '!', c: 'red' } : k === 'checks' ? checksBadge(checks.data, ctx.state.simTime) : null;
          return (
            <button key={k} className="mdt-tile" style={{ '--tc': P.color } as React.CSSProperties} onClick={() => ctx.go(k)}>
              {badge && <span className={`mdt-badge ${badge.c}`}>{badge.n}</span>}
              <span className="mdt-tile-ic">
                <P.Icon size={72} />
              </span>
              <span className="mdt-tile-lbl">{P.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** מסך כניסה — בחירת הרכב שהטאבלט מותקן בו */
function Picker({ state }: { state: SimState }) {
  const groups = mainStations(state.stations).map((m) => ({
    main: m,
    vehicles: [m, ...subStations(state.stations, m.id)].flatMap((s) => state.vehicles.filter((x) => x.stationId === s.id).sort(byUnit)),
  }));
  const label = (x: Vehicle) => stationShort(state.stations.find((s) => s.id === x.stationId)!);
  return (
    <div className="mdt-page mdt-picker">
      <p className="mdt-hint">בחר את הרכב שבו מותקן הטאבלט. כל טאבלט מחובר לאותה הדמיה — הזנקות, סטטוסים וקשר מסונכרנים עם המשל״ט.</p>
      {groups.map(({ main, vehicles }) => (
        <section key={main.id}>
          <h3>{stationShort(main)}</h3>
          <div className="mdt-pick-row">
            {vehicles.map((x) => (
              <a key={x.id} className="mdt-pick" href={`${TABLET_ROOT}${encodeURIComponent(x.id)}`}>
                <span className={`mdt-pick-dot st-${x.status}`} />
                <b className="mono">{x.unit}</b>
                <span>{label(x)}</span>
                {x.incidentId && <span className="mdt-pick-inc">באירוע #{x.incidentId}</span>}
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
