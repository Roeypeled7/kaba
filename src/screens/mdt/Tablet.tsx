import { useLayoutEffect, useState } from 'react';
import { INCIDENT_TYPE, STATUS_LABEL } from '../../engine/config';
import type { SimState, Vehicle } from '../../engine/model';
import { fmtHM, mainStations, stationShort, subStations, byUnit } from '../../components/ui';
import { audioReady, playAlarm, unlockAudio, useSoundLoop } from '../../sound';
import { IcBack, IcBarrier, IcBattery, IcFlame, IcGauge, IcHazard, IcHelmet, IcHome, IcHydrant, IcMenu, IcWalkie, IcWrenchCheck, Watermark } from './icons';
import { useLocal, type Ctx, type Send } from './shared';
import Events from './Events';
import Crew from './Crew';
import Checks, { CHECK_TITLE, useChecks, checksBadge } from './Checks';
import Radios from './Radios';
import Hazmat from './Hazmat';
import Dashboard from './Dashboard';
import Gates from './Gates';
import Tools from './Tools';
import './mdt.css';

export const MDT_VERSION = '1.7.4';
const W = 1280;
const H = 800;
const BEZEL_X = 46;
const BEZEL_Y = 42;

/** צבע האריח — גוני אש ובטיחות: אדום, כתום, ענבר, ירוק-בטיחות, ואפור-פלדה לציוד */
const PAGES: Record<string, { title: string; color: string; Icon: (p: { size?: number }) => JSX.Element; Comp: (c: Ctx) => JSX.Element }> = {
  events: { title: 'האירועים שלי', color: '#ff3d2e', Icon: IcFlame, Comp: Events },
  crew: { title: 'צוות ברכב', color: '#ffb020', Icon: IcHelmet, Comp: Crew },
  checks: { title: 'בדיקות רכב', color: '#3ddc84', Icon: IcWrenchCheck, Comp: Checks },
  radios: { title: 'צימוד מכשירי קשר', color: '#ff7a1a', Icon: IcWalkie, Comp: Radios },
  hazmat: { title: 'חומ״ס', color: '#ffd400', Icon: IcHazard, Comp: Hazmat },
  dashboard: { title: 'דאשבורד', color: '#ff5c3a', Icon: IcGauge, Comp: Dashboard },
  gates: { title: 'פתיחת שערים', color: '#9fb3c8', Icon: IcBarrier, Comp: Gates },
  tools: { title: 'כלי עזר', color: '#e8322a', Icon: IcHydrant, Comp: Tools },
};
const HOME_ORDER = ['events', 'crew', 'checks', 'radios', 'hazmat', 'dashboard', 'gates', 'tools'];

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

  const base = v ? `#/mdt/${encodeURIComponent(v.id)}` : '#/mdt';
  const go = (sub: string) => {
    setDrawer(false);
    location.hash = sub ? `${base}/${sub}` : base;
  };

  const page = segs[0] ? PAGES[segs[0]] : undefined;
  const subTitle = !v ? 'בחירת רכב' : !page ? 'מסך הבית' : segs[0] === 'checks' && segs[1] ? CHECK_TITLE[segs[1]] ?? page.title : page.title;
  const back = () => (!v ? (location.hash = '#/') : segs.length > 1 ? go(segs.slice(0, -1).join('/')) : segs.length ? go('') : (location.hash = '#/mdt'));

  // הזנקה שממתינה לאישור ושכוללת את הרכב הזה
  const alarm = v ? state.dispatches.find((d) => !d.ack && d.vehicleIds.includes(v.id)) : undefined;
  useSoundLoop(!!alarm, playAlarm, 4500);

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
              <button className="mdt-iconbtn" onClick={() => (v ? go('') : (location.hash = '#/mdt'))} aria-label="מסך הבית">
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

          {ctx && alarm && <AlarmOverlay ctx={ctx} dispatchIds={state.dispatches.filter((d) => !d.ack && d.incidentId === alarm.incidentId).map((d) => d.id)} />}

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
                <button onClick={() => ((location.hash = '#/mdt'), setDrawer(false))}>⇄ החלפת רכב</button>
                <button onClick={() => (setFrame(bezel ? 'full' : 'bezel'), setDrawer(false))}>{bezel ? '⛶ מסך מלא' : '▭ תצוגת טאבלט'}</button>
                <button onClick={() => (location.hash = '#/')}>↩ חזרה למשל״ט</button>
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
                <P.Icon size={58} />
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
              <a key={x.id} className="mdt-pick" href={`#/mdt/${encodeURIComponent(x.id)}`}>
                <span className={`mdt-pick-dot st-${x.status}`} />
                <b className="mono">{x.unit}</b>
                <span>{label(x)}</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AlarmOverlay({ ctx, dispatchIds }: { ctx: Ctx; dispatchIds: string[] }) {
  const { state, send, v } = ctx;
  const inc = state.incidents.find((i) => i.id === v.incidentId);
  const t = inc ? INCIDENT_TYPE[inc.typeKey] : undefined;
  const units = inc ? state.vehicles.filter((x) => x.incidentId === inc.id) : [];
  const ack = () => {
    dispatchIds.forEach((id) => send({ type: 'ackDispatch', dispatchId: id }));
    ctx.go('events');
  };
  return (
    <div className="mdt-alarm">
      <div className="mdt-alarm-word">הזנקה</div>
      {inc && t ? (
        <>
          <div className="mdt-alarm-type">
            {t.icon} {t.label} <span className={`mdt-sev s${inc.severity}`}>חומרה {inc.severity}</span>
          </div>
          <div className="mdt-alarm-addr">📍 {inc.address}</div>
          {inc.notes && <div className="mdt-alarm-notes">“{inc.notes}”</div>}
          <div className="mdt-alarm-units">
            {units.map((x) => (
              <span key={x.id} className={x.id === v.id ? 'me' : ''}>
                {x.callsign}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mdt-alarm-type">הוזנקתם — פרטי האירוע מתעדכנים</div>
      )}
      <button className="mdt-btn big white" onClick={ack}>
        ✓ קיבלתי — לפרטי האירוע
      </button>
    </div>
  );
}
