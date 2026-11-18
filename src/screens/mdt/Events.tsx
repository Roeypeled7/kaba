import { useEffect, useRef, useState } from 'react';
import { AMB_STATUS_LABEL, INCIDENT_STATUS_LABEL, INCIDENT_TYPE, STATUS_LABEL } from '../../engine/config';
import type { Incident, IncidentUpdate, Vehicle } from '../../engine/model';
import { SceneMedia } from '../../components/scene';
import { VEHICLE_ACTIONS, fmtElapsed, fmtHM, stationShort } from '../../components/ui';
import { playPing } from '../../sound';
import { fmtDate, unitFeed, type Ctx } from './shared';
import Nav from './Nav';

/** תוויות הכפתור הראשי בטאבלט — קצרות יותר מבמסך התחנה; הפעולה עצמה נשארת של VEHICLE_ACTIONS */
const TABLET_LABEL: Partial<Record<Vehicle['status'], string>> = {
  dispatched: 'יצאנו',
  enroute: 'במקום',
  onscene: 'אירוע הסתיים',
  cleared: 'חוזרים לתחנה',
  returning: 'בתחנה',
};

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
  const actLabel = TABLET_LABEL[v.status] ?? act?.label;
  const [view, setView] = useState<IncidentUpdate | null>(null);
  const fresh = useFreshUpdates(inc);

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
              {actLabel}
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
  const updates = [...inc.updates].reverse();

  return (
    <div className="mdt-nav-split">
      {/* ימין: פרטי האירוע ועדכונים */}
      <section className="mdt-panel mdt-details">
        <div className="mdt-scroll mdt-details-scroll">
          <div className="mdt-inc-head">
            <span className="mdt-inc-type">
              {t.icon} {t.label}
            </span>
            <span className={`mdt-sev s${inc.severity}`}>חומרה {inc.severity}</span>
            <span className="mdt-inc-meta">
              <span className="mono dim">#{inc.id}</span>
              <span className="mono">{fmtElapsed(state.simTime - inc.openedAt)}</span>
            </span>
          </div>
          {/* מה קרה — ואיפה בדיוק: כתובת, קומה, דירה וקוד הכניסה */}
          {inc.notes && (
            <div className="mdt-inc-what">
              <span className="mdt-inc-lbl">מה קרה</span>
              {inc.notes}
            </div>
          )}
          <div className="mdt-inc-where">
            <span className="mdt-inc-lbl">כתובת</span>
            <div className="mdt-inc-addr">📍 {inc.address}</div>
            {inc.site && (
              <div className="mdt-inc-site">
                <div>
                  <span>קומה</span>
                  <b className="mono">{inc.site.floor ?? '—'}</b>
                </div>
                <div>
                  <span>דירה</span>
                  <b className="mono">{inc.site.apartment ?? '—'}</b>
                </div>
                <div>
                  <span>קוד לבניין</span>
                  <b className="mono">{inc.site.entryCode ?? '—'}</b>
                </div>
              </div>
            )}
          </div>

          <div className="mdt-sec-h">
            עדכונים מהזירה <span className="mdt-count">{inc.updates.length}</span>
          </div>
          <div className="mdt-updates">
            {!updates.length && <div className="mdt-empty">עוד לא התקבלו עדכונים מהמוקד</div>}
            {updates.map((u) => (
              <div key={u.id} className={`mdt-update ${u.media ? 'has-media' : ''} ${fresh.has(u.id) ? 'fresh' : ''}`}>
                <div className="mdt-update-head">
                  {fresh.has(u.id) && <span className="mdt-new">חדש</span>}
                  <b>{u.from}</b>
                  <span className="mono dim">{fmtHM(u.t)}</span>
                  {u.media && <span className="mdt-update-kind">{u.media.kind === 'video' ? '🎥 סרטון' : '📷 תמונה'}</span>}
                </div>
                <div>{u.text}</div>
                {u.media && (
                  <button className="mdt-media-btn" onClick={() => setView(u)} aria-label="פתח במסך מלא">
                    <SceneMedia typeKey={inc.typeKey} media={u.media} t={u.t} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mdt-sec-h">כוחות באירוע</div>
          <div className="mdt-forces">
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

          <div className="mdt-sec-h">יומן אירוע</div>
          <div className="mdt-log">
            {[...inc.log].reverse().map((l, i) => (
              <div key={i}>
                <span className="mono dim">{fmtHM(l.t)}</span> {l.text}
              </div>
            ))}
          </div>
        </div>

        {/* הכפתור הראשי — קבוע בתחתית הפאנל, תמיד מול העיניים */}
        {act && (
          <div className="mdt-details-foot">
            <button
              className={`mdt-btn huge ${act.cls}`}
              onClick={() => {
                send({ type: 'vehicleAction', vehicleId: v.id, action: act.action });
              }}
            >
              {actLabel}
            </button>
          </div>
        )}
      </section>

      {/* שמאל: ניווט בתוך המערכת */}
      <Nav ctx={ctx} inc={inc} />

      {view?.media && (
        <div className="mdt-lightbox" onClick={() => setView(null)}>
          <div className="mdt-lightbox-in" onClick={(e) => e.stopPropagation()}>
            <SceneMedia typeKey={inc.typeKey} media={view.media} t={view.t} playing={view.media.kind === 'video'} className="large" />
            {view.media.kind === 'video' && (
              <div className="mdt-vid-bar">
                <i style={{ animationDuration: `${view.media.duration ?? 12}s` }} />
              </div>
            )}
            <div className="mdt-lightbox-cap">
              <b>{view.from}</b> · <span className="mono">{fmtHM(view.t)}</span>
              <div>{view.text}</div>
            </div>
            <button className="mdt-btn white" onClick={() => setView(null)}>
              סגירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** עדכונים שהגיעו מהזירה בזמן שהמסך פתוח — מצלצל ומסמן "חדש" לחצי דקה */
function useFreshUpdates(inc: Incident | undefined) {
  const seen = useRef<{ inc?: string; ids: Set<number> }>({ ids: new Set() });
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const ids = inc?.updates.map((u) => u.id) ?? [];
  useEffect(() => {
    // אירוע חדש — מה שכבר קיים בו לא נחשב חדש
    if (seen.current.inc !== inc?.id) {
      seen.current = { inc: inc?.id, ids: new Set(ids) };
      return;
    }
    const added = ids.filter((id) => !seen.current.ids.has(id));
    if (!added.length) return;
    added.forEach((id) => seen.current.ids.add(id));
    playPing();
    setFresh((f) => new Set([...f, ...added]));
    const tm = setTimeout(() => setFresh((f) => new Set([...f].filter((id) => !added.includes(id)))), 30_000);
    return () => clearTimeout(tm);
  }, [inc?.id, ids.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return fresh;
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
                {inc.updates.some((u) => u.media) && <span className="dim small">📷 {inc.updates.filter((u) => u.media).length}</span>}
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
