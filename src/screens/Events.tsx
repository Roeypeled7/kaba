import { useState } from 'react';
import { INCIDENT_TYPE, UNIT_LABEL } from '../engine/config';
import type { Command, Incident, IncidentStatus, SimState, UnitType } from '../engine/model';
import { IncidentBadge, IncidentTitle, SimControls, TopBar, UnitTag, fmtElapsed, fmtHM } from '../components/ui';
import { IncidentCard } from './Dispatch';

type Send = (c: Command) => void;

/** עמודות הלוח לפי שלב האירוע — משמאל לימין במחזור החיים */
const COLUMNS: { status: IncidentStatus; title: string; sub: string; color: string }[] = [
  { status: 'new', title: 'לשיגור', sub: 'נפתחו — ממתינים להזנקה', color: 'var(--st-dispatched)' },
  { status: 'dispatched', title: 'הוזנק', sub: 'כוחות הוזנקו ובדרך', color: 'var(--st-enroute)' },
  { status: 'active', title: 'במקום', sub: 'כוחות בזירה — בטיפול', color: 'var(--st-onscene)' },
  { status: 'controlled', title: 'פנויים', sub: 'נשלט — כוחות מתפנים', color: 'var(--st-cleared)' },
  { status: 'closed', title: 'יציאה', sub: 'אירועים שהסתיימו', color: 'var(--st-offline)' },
];

/** כמה אירועים שהסתיימו מוצגים בעמודת היציאה */
const CLOSED_SHOWN = 20;

/** חומרה גבוהה קודם, ובתוך אותה חומרה — הוותיק קודם */
const byUrgency = (a: Incident, b: Incident) => b.severity - a.severity || a.openedAt - b.openedAt;

export default function Events({ state, send }: { state: SimState; send: Send }) {
  const [selId, setSelId] = useState<string | null>(null);
  const sel = selId ? state.incidents.find((i) => i.id === selId) ?? null : null;

  const cols = COLUMNS.map((c) => {
    const list = state.incidents.filter((i) => i.status === c.status);
    return { ...c, total: list.length, list: c.status === 'closed' ? list.slice(-CLOSED_SHOWN).reverse() : list.sort(byUrgency) };
  });
  const fire = state.vehicles.filter((v) => v.status !== 'offline');
  const free = fire.filter((v) => v.status === 'available').length;

  return (
    <div className="screen events-screen">
      <TopBar state={state} title="לוח אירועים" accent="#ffd166">
        <span className="ev-free">
          כוחות זמינים{' '}
          <b className="mono">
            {free}/{fire.length}
          </b>
        </span>
        <SimControls state={state} send={send} compact />
      </TopBar>
      <div className={`ev-layout ${sel ? 'with-detail' : ''}`}>
        <div className="ev-board">
          {cols.map((c) => (
            <section key={c.status} className="ev-col" style={{ '--col': c.color } as React.CSSProperties}>
              <header className="ev-col-head">
                <div>
                  <b>{c.title}</b>
                  <div className="ev-col-sub">{c.sub}</div>
                </div>
                <span className="ev-n mono">{c.total}</span>
              </header>
              <div className="ev-col-body">
                {!c.list.length && (
                  <div className="empty">{c.status === 'new' && state.autoDispatch ? 'שיגור אוטומטי פעיל — אירועים מוזנקים מיד' : 'אין אירועים'}</div>
                )}
                {c.list.map((inc) => (
                  <BoardCard key={inc.id} inc={inc} state={state} send={send} on={inc.id === selId} onSelect={() => setSelId(inc.id === selId ? null : inc.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
        {sel && (
          <aside className="panel ev-detail">
            <div className="row gap ev-detail-head">
              <h2>פרטי אירוע</h2>
              <button className="btn xs ghost push" onClick={() => setSelId(null)}>
                סגור ✕
              </button>
            </div>
            {sel.status === 'closed' ? <ClosedDetail inc={sel} /> : <IncidentCard key={sel.id} inc={sel} state={state} send={send} />}
          </aside>
        )}
      </div>
    </div>
  );
}

function BoardCard({ inc, state, send, on, onSelect }: { inc: Incident; state: SimState; send: Send; on: boolean; onSelect: () => void }) {
  const units = inc.vehicleIds.map((id) => state.vehicles.find((v) => v.id === id)!).filter((v) => v && v.incidentId === inc.id);
  const ambs = inc.ambulanceIds.filter((id) => state.ambulances.find((a) => a.id === id)?.incidentId === inc.id).length;
  const shortage = Object.entries(inc.shortage).filter(([, n]) => n > 0);
  const closed = inc.status === 'closed';

  return (
    <div className={`ev-card ${on ? 'on' : ''}`} role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => e.key === 'Enter' && onSelect()}>
      <div className="ev-card-head">
        <IncidentTitle inc={inc} />
        <span className="mono dim push">{closed ? `${fmtHM(inc.openedAt)}–${inc.closedAt ? fmtHM(inc.closedAt) : ''}` : fmtElapsed(state.simTime - inc.openedAt)}</span>
      </div>
      <div className="ev-addr">📍 {inc.address}</div>
      {closed ? (
        <div className="dim small">
          {inc.vehicleIds.length} רכבים השתתפו{inc.ambulanceIds.length ? ` · ${inc.ambulanceIds.length} אמבולנסים` : ''}
        </div>
      ) : (
        (units.length > 0 || ambs > 0) && (
          <div className="ev-units">
            {units.map((v) => (
              <UnitTag key={v.id} v={v} />
            ))}
            {ambs > 0 && <span className="unit-tag amb">✚ {ambs}</span>}
          </div>
        )
      )}
      {shortage.length > 0 && !closed && inc.status !== 'controlled' && (
        <div className="warn small">⚠ חוסר: {shortage.map(([k, n]) => `${n} ${UNIT_LABEL[k as UnitType]}`).join(', ')}</div>
      )}
      {inc.status === 'new' && (
        <div className="row gap">
          <button
            className="btn fire sm grow"
            onClick={(e) => {
              e.stopPropagation();
              send({ type: 'dispatchRecommended', incidentId: inc.id });
            }}
          >
            🚨 הזנק לפי המלצה
          </button>
          <button
            className="btn ghost sm"
            onClick={(e) => {
              e.stopPropagation();
              if (!on) onSelect();
            }}
          >
            בחירת כוחות
          </button>
        </div>
      )}
    </div>
  );
}

function ClosedDetail({ inc }: { inc: Incident }) {
  return (
    <div className="inc-card inc-closed">
      <div className="inc-head">
        <IncidentTitle inc={inc} />
        <IncidentBadge inc={inc} />
      </div>
      <div className="inc-addr">
        📍 {inc.address} <span className="dim">· {inc.caller} {inc.phone}</span>
      </div>
      {inc.notes && <div className="inc-notes">“{inc.notes}”</div>}
      <div className="dim small">
        {INCIDENT_TYPE[inc.typeKey].label} · נפתח {fmtHM(inc.openedAt)} · נסגר {inc.closedAt ? fmtHM(inc.closedAt) : '—'} · {inc.vehicleIds.length} רכבים
      </div>
      <ol className="inc-log">
        {inc.log.map((l, i) => (
          <li key={i}>
            <span className="mono dim">{fmtHM(l.t)}</span> {l.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
