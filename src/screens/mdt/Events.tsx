import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet';
import { AMB_STATUS_LABEL, INCIDENT_STATUS_LABEL, INCIDENT_TYPE, STATUS_LABEL, UNIT_SPEED_KMH } from '../../engine/config';
import { distKm } from '../../engine/dispatch';
import { etaMin } from '../../engine/simulation';
import type { Incident, LatLng, Vehicle } from '../../engine/model';
import { DarkTiles, incidentIcon, stationIcon, vehicleIcon } from '../../components/mapkit';
import { VEHICLE_ACTIONS, fmtElapsed, fmtHM, stationShort } from '../../components/ui';
import { fmtDate, unitFeed, type Ctx } from './shared';

const STEPS: [Vehicle['status'], string][] = [
  ['dispatched', 'הוזנק'],
  ['enroute', 'בדרך'],
  ['onscene', 'בזירה'],
  ['cleared', 'פנוי בזירה'],
  ['returning', 'חוזר'],
  ['available', 'בתחנה'],
];

const QUICK = ['האש בשליטה', 'נדרשת תגבורת', 'יש נפגעים בזירה', 'מבקשים חסימת משטרה', 'מבקשים חברת חשמל לניתוק'];

export default function Events(ctx: Ctx) {
  const { state, v } = ctx;
  const mine = state.incidents.filter((i) => i.vehicleIds.includes(v.id)).reverse();
  const current = state.incidents.find((i) => i.id === v.incidentId);
  const [tab, setTab] = useState<'current' | 'history'>('current');
  return (
    <div className="mdt-page">
      <div className="mdt-tabs">
        <button className={tab === 'current' ? 'on' : ''} onClick={() => setTab('current')}>
          אירוע נוכחי {current && <i className="mdt-live" />}
        </button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          היסטוריית אירועים <span className="mono">({mine.length})</span>
        </button>
      </div>
      {tab === 'current' ? <Current ctx={ctx} inc={current} /> : <History ctx={ctx} list={mine} />}
    </div>
  );
}

function Current({ ctx, inc }: { ctx: Ctx; inc: Incident | undefined }) {
  const { state, send, v, st } = ctx;
  const act = VEHICLE_ACTIONS[v.status];
  const stepIdx = STEPS.findIndex(([s]) => s === v.status);

  if (!inc) {
    return (
      <div className="mdt-split">
        <section className="mdt-panel grow mdt-idle">
          <div className="mdt-idle-st">
            <span className={`mdt-stdot big st-${v.status}`}>{STATUS_LABEL[v.status]}</span>
            <span className="mono">{fmtElapsed(state.simTime - v.statusSince)}</span>
          </div>
          <p>{v.status === 'returning' ? 'חוזרים לתחנה.' : v.status === 'offline' ? 'הרכב לא כשיר — אין הזנקות.' : 'אין אירוע פעיל. ההזנקה הבאה תקפוץ על המסך.'}</p>
          {act && v.status !== 'available' && (
            <button className={`mdt-btn huge ${act.cls}`} onClick={() => send({ type: 'vehicleAction', vehicleId: v.id, action: act.action })}>
              {act.label}
            </button>
          )}
        </section>
        <section className="mdt-panel side">
          <div className="mdt-panel-h">ערוץ {stationShort(st)}</div>
          <Feed ctx={ctx} />
        </section>
      </div>
    );
  }

  const t = INCIDENT_TYPE[inc.typeKey];
  const others = state.vehicles.filter((x) => x.incidentId === inc.id && x.id !== v.id);
  const ambs = state.ambulances.filter((a) => inc.ambulanceIds.includes(a.id) && a.incidentId === inc.id);
  const km = distKm(v.pos, inc.pos);

  return (
    <div className="mdt-split">
      <section className="mdt-panel grow">
        <div className="mdt-inc-head">
          <span className="mdt-inc-type">
            {t.icon} {t.label}
          </span>
          <span className={`mdt-sev s${inc.severity}`}>חומרה {inc.severity}</span>
          <span className="grow" />
          <span className="mono dim">#{inc.id}</span>
          <span className="mono">{fmtElapsed(state.simTime - inc.openedAt)}</span>
        </div>
        <div className="mdt-inc-addr">📍 {inc.address}</div>
        {inc.notes && <div className="mdt-inc-notes">“{inc.notes}”</div>}
        <div className="mdt-inc-caller">
          מדווח: {inc.caller} · <span className="mono">{inc.phone}</span> · {INCIDENT_STATUS_LABEL[inc.status]}
        </div>

        <ol className="mdt-steps">
          {STEPS.map(([s, label], i) => (
            <li key={s} className={i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}>
              <i>{i < stepIdx ? '✓' : i + 1}</i>
              {label}
            </li>
          ))}
        </ol>

        <div className="mdt-act-row">
          {act && (
            <button className={`mdt-btn huge ${act.cls}`} onClick={() => send({ type: 'vehicleAction', vehicleId: v.id, action: act.action })}>
              {act.label}
            </button>
          )}
          <div className="mdt-eta">
            <b className="mono">{km.toFixed(1)}</b> ק״מ
            {(v.status === 'enroute' || v.status === 'dispatched') && (
              <>
                {' · '}
                <b className="mono">{etaMin(v.pos, inc.pos, UNIT_SPEED_KMH[v.type])}</b> דק׳ הגעה
              </>
            )}
          </div>
        </div>

        <div className="mdt-quick">
          {QUICK.map((q) => (
            <button key={q} className="mdt-btn sm" onClick={() => send({ type: 'unitRadio', vehicleId: v.id, text: q })}>
              📻 {q}
            </button>
          ))}
        </div>

        <div className="mdt-panel-h small">יומן אירוע</div>
        <div className="mdt-scroll mdt-log">
          {[...inc.log].reverse().map((l, i) => (
            <div key={i}>
              <span className="mono dim">{fmtHM(l.t)}</span> {l.text}
            </div>
          ))}
        </div>
      </section>

      <section className="mdt-panel side">
        <div className="mdt-map">
          <MapContainer center={[inc.pos.lat, inc.pos.lng]} zoom={13} zoomControl={false} attributionControl={false}>
            <DarkTiles />
            <FitBoth a={v.pos} b={inc.pos} id={inc.id} />
            <Marker position={[st.pos.lat, st.pos.lng]} icon={stationIcon(st, stationShort(st))} />
            <Polyline positions={[[v.pos.lat, v.pos.lng], [inc.pos.lat, inc.pos.lng]]} pathOptions={{ color: '#1fc3f1', weight: 4, dashArray: '8 8' }} />
            <Marker position={[inc.pos.lat, inc.pos.lng]} icon={incidentIcon(inc, true)} />
            {others.map((x) => (
              <Marker key={x.id} position={[x.pos.lat, x.pos.lng]} icon={vehicleIcon(x)} />
            ))}
            <Marker position={[v.pos.lat, v.pos.lng]} icon={vehicleIcon(v)} zIndexOffset={500} />
          </MapContainer>
        </div>
        <div className="mdt-panel-h small">כוחות באירוע</div>
        <div className="mdt-scroll mdt-forces">
          {others.map((x) => (
            <div key={x.id}>
              <b>{x.callsign}</b>
              <span className={`mdt-stdot st-${x.status}`}>{STATUS_LABEL[x.status]}</span>
            </div>
          ))}
          {ambs.map((a) => (
            <div key={a.id}>
              <b>✚ {a.callsign}</b>
              <span className="mdt-stdot amb">{AMB_STATUS_LABEL[a.status]}</span>
            </div>
          ))}
          {inc.policeNotified && (
            <div>
              <b>🚓 משטרה</b>
              <span className="dim">עודכנה</span>
            </div>
          )}
          {!others.length && !ambs.length && !inc.policeNotified && <div className="mdt-empty">רק הרכב שלכם באירוע</div>}
        </div>
      </section>
    </div>
  );
}

/** מתאים את התצוגה כך שהרכב והאירוע ייראו יחד */
function FitBoth({ a, b, id }: { a: LatLng; b: LatLng; id: string }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLngBounds([a.lat, a.lng], [b.lat, b.lng]), { padding: [40, 40], maxZoom: 15, animate: false });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Feed({ ctx }: { ctx: Ctx }) {
  const feed = unitFeed(ctx.state, ctx.v, 12);
  return (
    <div className="mdt-scroll mdt-feed">
      {!feed.length && <div className="mdt-empty">אין תעבורה</div>}
      {feed.map((m) => (
        <div key={m.id} className={m.from === ctx.v.callsign ? 'me' : ''}>
          <span className="mono dim">{fmtHM(m.t)}</span> <b>{m.from}</b>: {m.text}
        </div>
      ))}
    </div>
  );
}

function History({ ctx, list }: { ctx: Ctx; list: Incident[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="mdt-panel grow">
      <div className="mdt-scroll mdt-rows">
        {!list.length && <div className="mdt-empty">הרכב עוד לא יצא לאירועים בהדמיה הזו</div>}
        {list.map((inc) => {
          const t = INCIDENT_TYPE[inc.typeKey];
          const dur = (inc.closedAt ?? ctx.state.simTime) - inc.openedAt;
          return (
            <div key={inc.id} className="mdt-row hist" onClick={() => setOpen(open === inc.id ? null : inc.id)}>
              <div className="mdt-hist-top">
                <span className="mono dim">#{inc.id}</span>
                <span className="mono">{fmtDate(inc.openedAt)}</span>
                <b>
                  {t.icon} {t.label}
                </b>
                <span className="grow">{inc.address}</span>
                <span className="mono">{fmtElapsed(dur)}</span>
                <span className={`mdt-inc-st i-${inc.status}`}>{INCIDENT_STATUS_LABEL[inc.status]}</span>
              </div>
              {open === inc.id && (
                <div className="mdt-log light">
                  {inc.log.map((l, i) => (
                    <div key={i}>
                      <span className="mono dim">{fmtHM(l.t)}</span> {l.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
