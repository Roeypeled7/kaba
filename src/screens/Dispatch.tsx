import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, useMapEvents } from 'react-leaflet';
import { ADDRESSES, AMB_STATUS_LABEL, DISTRICT, INCIDENT_TYPE, INCIDENT_TYPES, UNIT_LABEL, UNIT_SPEED_KMH } from '../engine/config';
import { recommend, requirement } from '../engine/dispatch';
import { etaMin } from '../engine/simulation';
import type { Assignment, Command, Incident, IncomingCall, LatLng, SimState, Station, UnitType, Vehicle } from '../engine/model';
import { DarkTiles, FitDistrict, FlyTo, pinIcon } from '../components/mapkit';
import {
  AmbChip,
  IncidentBadge,
  IncidentTitle,
  SimControls,
  StatusChip,
  TopBar,
  UnitTag,
  byUnit,
  crewLabel,
  fmtElapsed,
  fmtHM,
  mainStations,
  stationShort,
  subStations,
  teamUnit,
  turnUnit,
} from '../components/ui';
import { SceneMedia } from '../components/scene';
import { playRing, useSoundLoop } from '../sound';

type Send = (c: Command) => void;

const REINFORCE: UnitType[] = ['engine', 'ladder', 'tanker', 'commander'];

/** 'צוות 440' רק כשהצוות לא נובע כבר מאות הקריאה של הרכב */
function teamNote(state: SimState, a: Assignment, v: Vehicle): string | null {
  const unit = teamUnit(state.stations.find((s) => s.id === a.stationId), a.team);
  return unit && unit !== v.unit ? `צוות ${unit}` : null;
}

interface Draft {
  callId?: string;
  typeKey: string;
  severity: 1 | 2 | 3;
  address: string;
  pos: LatLng | null;
  caller: string;
  phone: string;
  notes: string;
}

const emptyDraft = (): Draft => ({ typeKey: 'structure', severity: 1, address: '', pos: null, caller: '', phone: '', notes: '' });

export default function Dispatch({ state, send }: { state: SimState; send: Send }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const ringing = state.calls.length > 0;
  useSoundLoop(ringing, playRing, 3000);

  const accept = (c: IncomingCall) => {
    const a = ADDRESSES[c.addressIdx];
    setDraft({ callId: c.id, typeKey: c.typeKey, severity: 1, address: a.name, pos: a.pos, caller: c.caller, phone: c.phone, notes: c.description });
  };

  const active = state.incidents.filter((i) => i.status !== 'closed').reverse();
  const closed = state.incidents.filter((i) => i.status === 'closed').slice(-6).reverse();

  return (
    <div className="screen dispatch">
      <TopBar state={state} title="קבלה ושיגור" accent="#ff6b35">
        <SimControls state={state} send={send} compact />
      </TopBar>
      <div className="dispatch-grid">
        <section className="panel calls-panel">
          <h2>
            שיחות נכנסות <span className="count">{state.calls.length}</span>
          </h2>
          {!state.calls.length && <div className="empty">אין שיחות ממתינות</div>}
          {state.calls.map((c) => (
            <div key={c.id} className={`call ${draft.callId === c.id ? 'taken' : 'ringing'}`}>
              <div className="call-head">
                <span className="ring-ico">☎</span>
                <b>{c.caller}</b>
                <span className="mono dim">{c.phone}</span>
                <span className="mono dim push">{fmtElapsed(state.simTime - c.t)}</span>
              </div>
              <div className="call-body">
                {INCIDENT_TYPE[c.typeKey].icon} “{c.description}” — {ADDRESSES[c.addressIdx].name}
              </div>
              <div className="row gap">
                <button className="btn primary sm" onClick={() => accept(c)}>
                  קבל שיחה
                </button>
                <button className="btn ghost sm" onClick={() => send({ type: 'dropCall', callId: c.id })}>
                  שיחת סרק
                </button>
              </div>
            </div>
          ))}
          <IncidentForm state={state} send={send} draft={draft} setDraft={setDraft} />
        </section>

        <section className="panel incidents-panel">
          <h2>
            אירועים פעילים <span className="count">{active.length}</span>
          </h2>
          {!active.length && <div className="empty">אין אירועים פעילים</div>}
          {active.map((inc) => (
            <IncidentCard key={inc.id} inc={inc} state={state} send={send} />
          ))}
          {closed.length > 0 && (
            <>
              <h3 className="sub">הסתיימו לאחרונה</h3>
              {closed.map((inc) => (
                <div key={inc.id} className="closed-row">
                  <IncidentTitle inc={inc} /> <span className="dim">{inc.address}</span>
                  <span className="mono dim push">
                    {fmtHM(inc.openedAt)}–{inc.closedAt ? fmtHM(inc.closedAt) : ''}
                  </span>
                </div>
              ))}
            </>
          )}
        </section>

        <section className="panel units-panel">
          <h2>לוח כוחות</h2>
          <UnitBoard state={state} />
        </section>
      </div>
    </div>
  );
}

function IncidentForm({ state, send, draft, setDraft }: { state: SimState; send: Send; draft: Draft; setDraft: (d: Draft) => void }) {
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  const rec = useMemo(
    () => (draft.pos ? recommend(state, draft.pos, requirement(draft.typeKey, draft.severity), draft.severity) : null),
    [state.version, draft.pos, draft.typeKey, draft.severity], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const valid = !!draft.pos && draft.address.trim().length > 0;

  const submit = () => {
    if (!valid || !draft.pos) return;
    send({
      type: 'openIncident',
      callId: draft.callId,
      typeKey: draft.typeKey,
      severity: draft.severity,
      address: draft.address,
      pos: draft.pos,
      caller: draft.caller || 'לא ידוע',
      phone: draft.phone || '—',
      notes: draft.notes,
    });
    setDraft(emptyDraft());
  };

  return (
    <div className="incident-form">
      <h3 className="sub">{draft.callId ? 'פתיחת אירוע מהשיחה' : 'פתיחת אירוע ידנית'}</h3>
      <div className="type-grid">
        {INCIDENT_TYPES.map((t) => (
          <button key={t.key} className={`type-btn ${draft.typeKey === t.key ? 'on' : ''}`} onClick={() => set({ typeKey: t.key })}>
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="row gap">
        <span className="lbl">חומרה</span>
        <div className="seg">
          {([1, 2, 3] as const).map((n) => (
            <button key={n} className={draft.severity === n ? `on sev-bg-${n}` : ''} onClick={() => set({ severity: n })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <select
        value={ADDRESSES.findIndex((a) => a.name === draft.address)}
        onChange={(e) => {
          const a = ADDRESSES[+e.target.value];
          if (a) set({ address: a.name, pos: a.pos });
        }}
      >
        <option value={-1}>— בחר כתובת מהרשימה או לחץ על המפה —</option>
        {ADDRESSES.map((a, i) => (
          <option key={a.name} value={i}>
            {a.name}
          </option>
        ))}
      </select>
      <input placeholder="כתובת" value={draft.address} onChange={(e) => set({ address: e.target.value })} />
      <div className="pick-map">
        <MapContainer center={[DISTRICT.center.lat, DISTRICT.center.lng]} zoom={DISTRICT.zoom} zoomSnap={0.25} zoomControl={false} attributionControl={false}>
          <DarkTiles />
          <FitDistrict points={state.stations.map((s) => s.pos)} />
          {state.stations.map((s) =>
            s.parentId === null ? (
              <CircleMarker key={s.id} center={[s.pos.lat, s.pos.lng]} radius={5} pathOptions={{ color: '#ff6b35', fillOpacity: 0.9, weight: 2 }} />
            ) : (
              <CircleMarker key={s.id} center={[s.pos.lat, s.pos.lng]} radius={2.5} pathOptions={{ color: '#c9805f', fillOpacity: 0.7, weight: 1 }} />
            ),
          )}
          {draft.pos && <Marker position={[draft.pos.lat, draft.pos.lng]} icon={pinIcon()} />}
          <FlyTo pos={draft.pos} zoom={12} />
          <PickHandler
            onPick={(pos) =>
              set({ pos, address: draft.address && !draft.address.startsWith('נקודה במפה') ? draft.address : `נקודה במפה (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})` })
            }
          />
        </MapContainer>
      </div>
      <div className="row gap">
        <input placeholder="שם המתקשר" value={draft.caller} onChange={(e) => set({ caller: e.target.value })} />
        <input placeholder="טלפון" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} className="mono" />
      </div>
      <textarea placeholder="תיאור / הערות" rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />

      {rec && (
        <div className="preview">
          <div className="lbl">{state.autoDispatch ? 'יוזנקו אוטומטית:' : 'המלצת המערכת:'}</div>
          <div className="preview-units">
            {rec.assignments.map((a) => {
              const v = state.vehicles.find((x) => x.id === a.vehicleId);
              if (!v) return null;
              const note = teamNote(state, a, v);
              return (
                <span key={a.vehicleId} className="unit-tag st-available">
                  {v.callsign}
                  {note && <small> · {note}</small>}
                  <small className="dim"> · {etaMin(v.pos, draft.pos!, UNIT_SPEED_KMH[v.type])}′</small>
                </span>
              );
            })}
            {INCIDENT_TYPE[draft.typeKey].ambulance && <span className="unit-tag amb">✚ בקשת מד״א</span>}
          </div>
          {Object.keys(rec.shortage).length > 0 && (
            <div className="warn">
              ⚠ חוסר:{' '}
              {Object.entries(rec.shortage)
                .map(([k, n]) => `${n} ${UNIT_LABEL[k as UnitType]}`)
                .join(', ')}
            </div>
          )}
        </div>
      )}
      <div className="row gap">
        <button className="btn fire big grow" disabled={!valid} onClick={submit}>
          {state.autoDispatch ? '🚨 פתח והזנק' : 'פתח אירוע'}
        </button>
        <button className="btn ghost" onClick={() => setDraft(emptyDraft())}>
          נקה
        </button>
      </div>
    </div>
  );
}

function PickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export function IncidentCard({ inc, state, send }: { inc: Incident; state: SimState; send: Send }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  // עדכון לכוחות בזירה — טקסט, או תמונה/סרטון "שהתקבלו מהמדווח" (איור סינתטי)
  const sendUpdate = (kind?: 'photo' | 'video') => {
    const text = note.trim() || (kind === 'video' ? 'סרטון שהתקבל מהמדווח' : kind ? 'תמונה שהתקבלה מהמדווח' : '');
    if (!text) return;
    send({
      type: 'addUpdate',
      incidentId: inc.id,
      text,
      from: kind ? 'המדווח' : 'מוקד',
      media: kind ? { kind, seed: Date.now() % 100_000, ...(kind === 'video' ? { duration: 10 + (Date.now() % 15) } : {}) } : undefined,
    });
    setNote('');
  };
  const units = inc.vehicleIds.map((id) => state.vehicles.find((v) => v.id === id)!).filter((v) => v.incidentId === inc.id);
  const ambs = inc.ambulanceIds.map((id) => state.ambulances.find((a) => a.id === id)!).filter((a) => a.incidentId === inc.id);
  const type = INCIDENT_TYPE[inc.typeKey];
  const total = type.workMin * 60 * (1 + 0.5 * (inc.severity - 1));
  const progress = inc.status === 'controlled' ? 1 : inc.status === 'active' ? 1 - inc.workLeft / total : 0;
  const shortage = Object.entries(inc.shortage).filter(([, n]) => n > 0);

  return (
    <div className={`inc-card inc-${inc.status}`}>
      <div className="inc-head">
        <IncidentTitle inc={inc} />
        <IncidentBadge inc={inc} />
        <span className="mono dim push">{fmtElapsed(state.simTime - inc.openedAt)}</span>
      </div>
      <div className="inc-addr">
        📍 {inc.address} <span className="dim">· {inc.caller} {inc.phone}</span>
      </div>
      {inc.notes && <div className="inc-notes">“{inc.notes}”</div>}
      <div className="progress">
        <div style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {inc.status === 'new' ? (
        <ManualDispatch inc={inc} state={state} send={send} />
      ) : (
        <div className="inc-units">
          {units.map((v) => (
            <span key={v.id} className="unit-wrap">
              <UnitTag v={v} />
              {v.status !== 'returning' && (
                <button className="x" title="שחרר מהאירוע" onClick={() => send({ type: 'releaseUnit', vehicleId: v.id })}>
                  ×
                </button>
              )}
            </span>
          ))}
          {ambs.map((a) => (
            <span key={a.id} className={`unit-tag amb amb-${a.status}`} title={AMB_STATUS_LABEL[a.status]}>
              ✚ {a.callsign}
            </span>
          ))}
          {!units.length && !ambs.length && <span className="dim">אין כוחות פעילים</span>}
        </div>
      )}
      {shortage.length > 0 && inc.status !== 'controlled' && (
        <div className="warn">⚠ חוסר כוחות: {shortage.map(([k, n]) => `${n} ${UNIT_LABEL[k as UnitType]}`).join(', ')}</div>
      )}

      {inc.status !== 'new' && inc.status !== 'controlled' && (
        <div className="inc-actions">
          <span className="lbl">תגבור:</span>
          {REINFORCE.map((t) => (
            <button key={t} className="btn xs" onClick={() => send({ type: 'reinforce', incidentId: inc.id, unitType: t })}>
              + {UNIT_LABEL[t]}
            </button>
          ))}
          <span className="sep" />
          <span className="lbl">חומרה:</span>
          <div className="seg xs">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} className={inc.severity === n ? `on sev-bg-${n}` : ''} onClick={() => send({ type: 'setSeverity', incidentId: inc.id, severity: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="inc-actions">
        <button className="btn xs" onClick={() => send({ type: 'requestAmbulance', incidentId: inc.id })}>
          ✚ בקש מד״א
        </button>
        <button className="btn xs" disabled={inc.policeNotified} onClick={() => send({ type: 'notifyPolice', incidentId: inc.id })}>
          🚓 {inc.policeNotified ? 'משטרה עודכנה' : 'עדכן משטרה'}
        </button>
        <button className="btn xs ghost" onClick={() => setOpen(!open)}>
          {open ? 'הסתר יומן' : `יומן (${inc.log.length})${inc.updates.length ? ` · עדכונים (${inc.updates.length})` : ''}`}
        </button>
        <button className="btn xs danger push" onClick={() => send({ type: 'closeIncident', incidentId: inc.id })}>
          סגור אירוע
        </button>
      </div>
      {inc.status !== 'closed' && (
        <div className="inc-update">
          <input placeholder="עדכון לכוחות בזירה…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendUpdate()} />
          <button className="btn xs" title="צרף תמונה שהתקבלה מהמדווח" onClick={() => sendUpdate('photo')}>
            📷
          </button>
          <button className="btn xs" title="צרף סרטון שהתקבל מהמדווח" onClick={() => sendUpdate('video')}>
            🎥
          </button>
          <button className="btn xs primary" disabled={!note.trim()} onClick={() => sendUpdate()}>
            שלח
          </button>
        </div>
      )}
      {open && (
        <>
          {inc.updates.length > 0 && (
            <div className="inc-updates">
              {[...inc.updates].reverse().map((u) => (
                <div key={u.id} className="inc-upd">
                  {u.media && <SceneMedia typeKey={inc.typeKey} media={u.media} t={u.t} className="thumb" />}
                  <div>
                    <b>{u.from}</b> <span className="mono dim">{fmtHM(u.t)}</span>
                    <div>{u.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <ol className="inc-log">
            {inc.log.map((l, i) => (
              <li key={i}>
                <span className="mono dim">{fmtHM(l.t)}</span> {l.text}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

/** מצב שיגור ידני: המלצה עם אפשרות להוריד יחידות לפני הזנקה */
function ManualDispatch({ inc, state, send }: { inc: Incident; state: SimState; send: Send }) {
  const rec = useMemo(() => recommend(state, inc.pos, requirement(inc.typeKey, inc.severity), inc.severity), [state.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [off, setOff] = useState<Set<string>>(new Set());
  const ids = rec.assignments.map((a) => a.vehicleId).filter((id) => !off.has(id));
  return (
    <div className="manual">
      <div className="lbl blink">ממתין לאישור הזנקה — המלצת המערכת:</div>
      <div className="preview-units">
        {rec.assignments.map((a) => {
          const v = state.vehicles.find((x) => x.id === a.vehicleId);
          if (!v) return null;
          const on = !off.has(a.vehicleId);
          const note = teamNote(state, a, v);
          return (
            <label key={a.vehicleId} className={`unit-tag pick ${on ? 'st-available' : 'off'}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  const n = new Set(off);
                  if (on) n.add(a.vehicleId);
                  else n.delete(a.vehicleId);
                  setOff(n);
                }}
              />
              {v.callsign}
              {note && <small> · {note}</small>}
            </label>
          );
        })}
      </div>
      <button className="btn fire" disabled={!ids.length} onClick={() => send({ type: 'dispatchUnits', incidentId: inc.id, vehicleIds: ids })}>
        🚨 הזנק ({ids.length})
      </button>
    </div>
  );
}

function UnitRow({ v, state }: { v: Vehicle; state: SimState }) {
  return (
    <div className="ub-row">
      <span className="callsign">{v.callsign}</span>
      <span className="dim small ub-crew">{crewLabel(v)}</span>
      <span className="push" />
      {v.incidentId && <span className="mono dim small">#{v.incidentId}</span>}
      <StatusChip v={v} />
    </div>
  );
}

function SubBlock({ st, state }: { st: Station; state: SimState }) {
  const vs = state.vehicles.filter((v) => v.stationId === st.id).sort(byUnit);
  return (
    <div className="ub-sub">
      <div className="ub-sub-name">↳ {stationShort(st)}</div>
      {vs.map((v) => (
        <UnitRow key={v.id} v={v} state={state} />
      ))}
    </div>
  );
}

function UnitBoard({ state }: { state: SimState }) {
  return (
    <div className="unit-board">
      {mainStations(state.stations).map((st) => (
        <div key={st.id} className="ub-station">
          <div className="ub-head">
            <b>{st.name}</b>
            <span className="turn">
              בתור: <b className="mono">{turnUnit(st)}</b>
            </span>
          </div>
          {state.vehicles
            .filter((v) => v.stationId === st.id)
            .sort(byUnit)
            .map((v) => (
              <UnitRow key={v.id} v={v} state={state} />
            ))}
          {subStations(state.stations, st.id).map((sub) => (
            <SubBlock key={sub.id} st={sub} state={state} />
          ))}
        </div>
      ))}
      <div className="ub-station">
        <div className="ub-head">
          <b>מד״א</b>
          <span className="dim small">לא בשליטת המוקד</span>
        </div>
        {state.ambulances.map((a) => (
          <div key={a.id} className="ub-row">
            <span className="callsign">{a.callsign}</span>
            <span className="dim small">{a.baseName}</span>
            <span className="push" />
            {a.incidentId && <span className="mono dim small">#{a.incidentId}</span>}
            <AmbChip a={a} />
          </div>
        ))}
      </div>
    </div>
  );
}
