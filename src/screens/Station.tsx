import { INCIDENT_TYPE, ROLE_LABEL, UNIT_LABEL, UNIT_SPEED_KMH } from '../engine/config';
import { etaMin } from '../engine/simulation';
import type { Command, SimState, Station as StationT, Vehicle } from '../engine/model';
import {
  STATION_ACCENT,
  StationPicker,
  StatusChip,
  TopBar,
  byUnit,
  fmtElapsed,
  fmtHM,
  stationGroupIds,
  stationShort,
  subStations,
  teamOut,
  teamUnit,
  turnUnit,
  VEHICLE_ACTIONS as ACTIONS,
} from '../components/ui';
import { playAlarm, useSoundLoop } from '../sound';

type Send = (c: Command) => void;
export default function Station({ state, send, id }: { state: SimState; send: Send; id: number }) {
  const st = state.stations.find((s) => s.id === id);
  const group = stationGroupIds(state.stations, id);
  const pending = state.dispatches.filter((d) => group.has(d.stationId) && !d.ack);
  useSoundLoop(pending.length > 0, playAlarm, 4500);

  if (!st || st.parentId !== null) {
    return (
      <div className="screen station">
        <TopBar state={state} title="עמדת תחנה">
          <StationPicker state={state} current={id} />
        </TopBar>
        <div className="loading">{st ? `${st.name} היא תחנת משנה — בחר את התחנה הראשית שלה` : `תחנה ${id} לא קיימת`}</div>
      </div>
    );
  }

  const subs = subStations(state.stations, id);
  const stationOf = (sid: number) => state.stations.find((s) => s.id === sid);
  const vehicles = state.vehicles.filter((v) => v.stationId === id).sort(byUnit);
  const history = state.dispatches.filter((d) => group.has(d.stationId)).slice(-10).reverse();
  const feed = state.radio.filter((m) => m.channel === `st${id}`).slice(-8).reverse();
  const other = st.teamOrder.find((t) => t !== st.turnTeam);
  // באנר אחד לכל אירוע, גם כשהוזנקו כמה רכבים/תחנות משנה
  const alarms: { incidentId: string; list: typeof pending }[] = [];
  for (const d of pending) {
    const g = alarms.find((a) => a.incidentId === d.incidentId);
    if (g) g.list.push(d);
    else alarms.push({ incidentId: d.incidentId, list: [d] });
  }

  return (
    <div className={`screen station ${pending.length ? 'alarming' : ''}`}>
      <TopBar state={state} title={`עמדת ${st.name}`} accent={STATION_ACCENT[id]}>
        <StationPicker state={state} current={id} />
      </TopBar>

      {alarms.map(({ incidentId, list }) => {
        const inc = state.incidents.find((i) => i.id === incidentId);
        if (!inc) return null;
        const t = INCIDENT_TYPE[inc.typeKey];
        const subNames = [...new Set(list.filter((d) => d.stationId !== id).map((d) => stationOf(d.stationId)?.name).filter(Boolean))];
        const units = [...new Set(list.filter((d) => d.stationId === id).map((d) => teamUnit(st, d.team)).filter(Boolean))];
        return (
          <div key={incidentId} className="alarm-banner">
            <div className="alarm-main">
              <div className="alarm-word">הזנקה!</div>
              <div>
                {subNames.length > 0 && <div className="alarm-sub">תחנת משנה: {subNames.join(', ')}</div>}
                <div className="alarm-type">
                  {t.icon} {t.label} <span className={`sev sev-${inc.severity}`}>חומרה {inc.severity}</span>
                </div>
                <div className="alarm-addr">📍 {inc.address}</div>
                {inc.notes && <div className="alarm-notes">“{inc.notes}”</div>}
              </div>
            </div>
            <div className="alarm-side">
              <div className="alarm-units">
                {list
                  .flatMap((d) => d.vehicleIds)
                  .map((vid) => {
                    const v = state.vehicles.find((x) => x.id === vid);
                    return v ? (
                      <span key={vid} className="alarm-unit">
                        {v.callsign}
                      </span>
                    ) : null;
                  })}
              </div>
              {units.length > 0 && <div className="alarm-team">צוות {units.join(' + ')}</div>}
              <button className="btn big light" onClick={() => list.forEach((d) => send({ type: 'ackDispatch', dispatchId: d.id }))}>
                ✓ אישור קבלה
              </button>
            </div>
          </div>
        );
      })}

      <div className="station-grid">
        <section className="panel teams-panel">
          <h2>סבב צוותים</h2>
          <div className="turn-big">
            <div className="lbl">בתור ליציאה הבאה</div>
            <div className="turn-letter mono">{turnUnit(st)}</div>
          </div>
          {st.teamOrder.map((tid) => {
            const team = st.teams[tid];
            if (!team) return null;
            const busy = teamOut(state.vehicles, id, tid);
            const out = state.vehicles.find((v) => v.stationId === id && v.crewTeam === tid && v.type !== 'commander' && v.incidentId);
            const inc = out && state.incidents.find((i) => i.id === out.incidentId);
            return (
              <div key={tid} className={`team-card ${st.turnTeam === tid ? 'next' : ''} ${busy ? 'out' : ''}`}>
                <div className="team-head">
                  <span className="team-letter">צוות {team.unit}</span>
                  {st.turnTeam === tid && <span className="chip st-dispatched">בתור</span>}
                  <span className="push" />
                  <span className={`chip ${busy ? 'st-onscene' : 'st-available'}`}>{busy ? 'בחוץ' : 'בתחנה'}</span>
                </div>
                <div className="team-crew">
                  <b>מפקד צוות: {team.leader}</b>
                  <div className="dim">{team.crew.join(' · ')}</div>
                </div>
                {inc && (
                  <div className="team-out">
                    באירוע #{inc.id} — {INCIDENT_TYPE[inc.typeKey].label}, {inc.address}
                  </div>
                )}
              </div>
            );
          })}
          {other && (
            <button className="btn sm ghost" onClick={() => send({ type: 'setTurnTeam', stationId: id, team: other })}>
              ⇄ העבר תור ל-{st.teams[other]?.unit ?? other}
            </button>
          )}
        </section>

        <div className="station-center">
          <section className="panel vehicles-panel">
            <h2>רכבי התחנה</h2>
            <div className="veh-grid">
              {vehicles.map((v) => (
                <VehicleCard key={v.id} v={v} state={state} send={send} />
              ))}
            </div>
          </section>

          {subs.length > 0 && (
            <section className="panel subs-panel">
              <h2>
                תחנות משנה <span className="count">{subs.length}</span>
              </h2>
              <div className="sub-grid">
                {subs.map((s) => (
                  <SubStationCard key={s.id} st={s} state={state} send={send} />
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="panel side-panel">
          <h2>יציאות אחרונות</h2>
          {!history.length && <div className="empty">אין יציאות במשמרת</div>}
          <table className="tbl">
            <tbody>
              {history.map((d) => {
                const inc = state.incidents.find((i) => i.id === d.incidentId);
                if (!inc) return null;
                const dst = stationOf(d.stationId);
                const isSub = d.stationId !== id;
                const unit = teamUnit(dst, d.team);
                return (
                  <tr key={d.id}>
                    <td className="mono dim">{fmtHM(d.t)}</td>
                    <td>
                      {INCIDENT_TYPE[inc.typeKey].icon} {INCIDENT_TYPE[inc.typeKey].label}
                      {isSub && dst && <div className="dim small">{stationShort(dst)}</div>}
                    </td>
                    <td>
                      {unit
                        ? `צוות ${unit}`
                        : d.vehicleIds.every((x) => state.vehicles.find((v) => v.id === x)?.type === 'commander')
                          ? 'פיקוד'
                          : '—'}
                    </td>
                    <td className="dim small">
                      {d.vehicleIds
                        .map((x) => state.vehicles.find((v) => v.id === x)?.callsign)
                        .filter(Boolean)
                        .join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h2>ערוץ התחנה</h2>
          {!feed.length && <div className="empty">אין תעבורה</div>}
          <div className="mini-feed">
            {feed.map((m) => (
              <div key={m.id} className={`feed-row ${m.outgoing ? 'out' : ''}`}>
                <span className="mono dim">{fmtHM(m.t)}</span> <b>{m.from}</b>: {m.text}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function IncLine({ v, state }: { v: Vehicle; state: SimState }) {
  const inc = state.incidents.find((i) => i.id === v.incidentId);
  if (!inc) return <span className="dim">—</span>;
  return (
    <>
      #{inc.id} {INCIDENT_TYPE[inc.typeKey].icon} {inc.address}
      {v.status === 'enroute' && <b> · {etaMin(v.pos, inc.pos, UNIT_SPEED_KMH[v.type])} דק׳</b>}
    </>
  );
}

function ActionButton({ v, send }: { v: Vehicle; send: Send }) {
  const act = ACTIONS[v.status];
  if (!act) return null;
  return (
    <button className={`btn ${act.cls} ${v.status === 'available' || v.status === 'offline' ? 'sm' : ''}`} onClick={() => send({ type: 'vehicleAction', vehicleId: v.id, action: act.action })}>
      {act.label}
    </button>
  );
}

function VehicleCard({ v, state, send }: { v: Vehicle; state: SimState; send: Send }) {
  const crew =
    v.type === 'commander' ? (
      <>
        <span className="role">{v.role ? ROLE_LABEL[v.role] : UNIT_LABEL.commander}</span>
        {v.crewName && <div>{v.crewName}</div>}
      </>
    ) : (
      <>
        {v.crewTeam && v.type === 'engine' ? `צוות ${v.unit}` : 'צוות עצמאי'}
        {v.crewName && <div className="dim">{v.crewName}</div>}
      </>
    );
  return (
    <div className={`veh-card st-border-${v.status}`}>
      <div className="veh-head">
        <span className="veh-sign mono">{v.unit}</span>
        <span className="dim">{UNIT_LABEL[v.type]}</span>
        <a className="veh-mdt" href={`tablet/#/${encodeURIComponent(v.id)}`} target="_blank" rel="noopener" title="פתח את הטאבלט של הרכב בחלון נפרד">
          טאבלט
        </a>
      </div>
      <div className="veh-status">
        <StatusChip v={v} big />
        <span className="dim small mono">{fmtElapsed(state.simTime - v.statusSince)}</span>
      </div>
      <div className="veh-crew">{crew}</div>
      {v.incidentId && (
        <div className="veh-inc">
          <IncLine v={v} state={state} />
        </div>
      )}
      <ActionButton v={v} send={send} />
    </div>
  );
}

function SubStationCard({ st, state, send }: { st: StationT; state: SimState; send: Send }) {
  const vehicles = state.vehicles.filter((v) => v.stationId === st.id).sort(byUnit);
  const team = st.teams[st.teamOrder[0] ?? st.turnTeam];
  return (
    <div className="sub-card">
      <div className="sub-head">
        <span className="sub-name">{st.name}</span>
        <span className="dim small mono">#{st.id}</span>
      </div>
      {vehicles.map((v) => (
        <div key={v.id} className={`sub-veh st-border-${v.status}`}>
          <div className="sub-veh-top">
            <span className="veh-sign mono">{v.unit}</span>
            <span className="dim small">{UNIT_LABEL[v.type]}</span>
            <span className="push" />
            <span className="dim small mono">{fmtElapsed(state.simTime - v.statusSince)}</span>
            <StatusChip v={v} />
          </div>
          <div className="sub-crew">
            {team && (
              <>
                <b>צוות {team.unit}</b> · {v.crewName ?? team.leader}
                {team.crew.length > 0 && <div className="dim small">{team.crew.join(' · ')}</div>}
              </>
            )}
            {!team && v.crewName}
          </div>
          {v.incidentId && (
            <div className="sub-inc small">
              <IncLine v={v} state={state} />
            </div>
          )}
          <ActionButton v={v} send={send} />
        </div>
      ))}
      {!vehicles.length && <div className="empty">אין רכבים</div>}
    </div>
  );
}
