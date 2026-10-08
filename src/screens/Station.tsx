import { INCIDENT_TYPE, UNIT_LABEL, UNIT_SPEED_KMH } from '../engine/config';
import { otherTeam, teamBusy } from '../engine/dispatch';
import { etaMin } from '../engine/simulation';
import type { Command, SimState, TeamId, Vehicle } from '../engine/model';
import { StatusChip, TopBar, fmtElapsed, fmtHM } from '../components/ui';
import { playAlarm, useSoundLoop } from '../sound';

type Send = (c: Command) => void;

const ACTIONS: Partial<Record<Vehicle['status'], { action: 'depart' | 'arrive' | 'clear' | 'home' | 'offline' | 'online'; label: string; cls: string }>> = {
  dispatched: { action: 'depart', label: 'יצאנו', cls: 'fire' },
  enroute: { action: 'arrive', label: 'הגענו לזירה', cls: 'warn' },
  onscene: { action: 'clear', label: 'פנויים — חוזרים', cls: 'ok' },
  cleared: { action: 'clear', label: 'חוזרים לתחנה', cls: 'ok' },
  returning: { action: 'home', label: 'בתחנה', cls: 'ok' },
  available: { action: 'offline', label: 'לא כשיר', cls: 'ghost' },
  offline: { action: 'online', label: 'חזר לכשירות', cls: 'ok' },
};

export default function Station({ state, send, id }: { state: SimState; send: Send; id: number }) {
  const st = state.stations.find((s) => s.id === id);
  const pending = state.dispatches.filter((d) => d.stationId === id && !d.ack);
  useSoundLoop(pending.length > 0, playAlarm, 4500);
  if (!st) return <div className="loading">תחנה {id} לא קיימת</div>;

  const vehicles = state.vehicles.filter((v) => v.stationId === id && v.id !== 'C01');
  const history = state.dispatches.filter((d) => d.stationId === id).slice(-8).reverse();
  const feed = state.radio.filter((m) => m.channel === `st${id}`).slice(-7).reverse();
  const accent = id === 1 ? '#ff6b35' : '#4cc9f0';

  return (
    <div className={`screen station ${pending.length ? 'alarming' : ''}`}>
      <TopBar state={state} title={`עמדת ${st.name}`} accent={accent} />

      {pending.map((d) => {
        const inc = state.incidents.find((i) => i.id === d.incidentId)!;
        const t = INCIDENT_TYPE[inc.typeKey];
        return (
          <div key={d.id} className="alarm-banner">
            <div className="alarm-main">
              <div className="alarm-word">הזנקה!</div>
              <div>
                <div className="alarm-type">
                  {t.icon} {t.label} <span className={`sev sev-${inc.severity}`}>חומרה {inc.severity}</span>
                </div>
                <div className="alarm-addr">📍 {inc.address}</div>
                {inc.notes && <div className="alarm-notes">“{inc.notes}”</div>}
              </div>
            </div>
            <div className="alarm-side">
              <div className="alarm-units">
                {d.vehicleIds.map((vid) => {
                  const v = state.vehicles.find((x) => x.id === vid)!;
                  return (
                    <span key={vid} className="alarm-unit">
                      {v.callsign}
                    </span>
                  );
                })}
              </div>
              {d.team && <div className="alarm-team">צוות {d.team}</div>}
              <button className="btn big light" onClick={() => send({ type: 'ackDispatch', dispatchId: d.id })}>
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
            <div className="lbl">הצוות שבתור ליציאה הבאה</div>
            <div className="turn-letter">{st.turnTeam}</div>
          </div>
          {(['א', 'ב'] as TeamId[]).map((tid) => {
            const team = st.teams[tid];
            const busy = teamBusy(state.vehicles, id, tid);
            const out = state.vehicles.find((v) => v.stationId === id && v.crewTeam === tid && v.type !== 'commander' && v.incidentId);
            const inc = out && state.incidents.find((i) => i.id === out.incidentId);
            return (
              <div key={tid} className={`team-card ${st.turnTeam === tid ? 'next' : ''} ${busy ? 'out' : ''}`}>
                <div className="team-head">
                  <span className="team-letter">צוות {tid}</span>
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
          <button className="btn sm ghost" onClick={() => send({ type: 'setTurnTeam', stationId: id, team: otherTeam(st.turnTeam) })}>
            ⇄ העבר תור לצוות {otherTeam(st.turnTeam)}
          </button>
        </section>

        <section className="panel vehicles-panel">
          <h2>רכבי התחנה</h2>
          <div className="veh-grid">
            {vehicles.map((v) => {
              const inc = state.incidents.find((i) => i.id === v.incidentId);
              const act = ACTIONS[v.status];
              return (
                <div key={v.id} className={`veh-card st-border-${v.status}`}>
                  <div className="veh-head">
                    <span className="veh-sign">{v.callsign}</span>
                    <span className="dim">{UNIT_LABEL[v.type]}</span>
                  </div>
                  <StatusChip v={v} big />
                  <div className="veh-crew">{v.type === 'commander' ? v.commanderName : v.crewTeam ? `צוות ${v.crewTeam}` : 'ללא צוות משויך'}</div>
                  <div className="veh-inc">
                    {inc ? (
                      <>
                        #{inc.id} {INCIDENT_TYPE[inc.typeKey].icon} {inc.address}
                        {v.status === 'enroute' && <b> · {etaMin(v.pos, inc.pos, UNIT_SPEED_KMH[v.type])} דק׳</b>}
                      </>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </div>
                  <div className="dim small mono">{fmtElapsed(state.simTime - v.statusSince)} בסטטוס</div>
                  {act && (
                    <button className={`btn ${act.cls}`} onClick={() => send({ type: 'vehicleAction', vehicleId: v.id, action: act.action })}>
                      {act.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel side-panel">
          <h2>יציאות אחרונות</h2>
          {!history.length && <div className="empty">אין יציאות במשמרת</div>}
          <table className="tbl">
            <tbody>
              {history.map((d) => {
                const inc = state.incidents.find((i) => i.id === d.incidentId)!;
                return (
                  <tr key={d.id}>
                    <td className="mono dim">{fmtHM(d.t)}</td>
                    <td>
                      {INCIDENT_TYPE[inc.typeKey].icon} {INCIDENT_TYPE[inc.typeKey].label}
                    </td>
                    <td>{d.team ? `צוות ${d.team}` : 'פיקוד'}</td>
                    <td className="dim small">{d.vehicleIds.map((x) => state.vehicles.find((v) => v.id === x)!.callsign).join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h2>ערוץ התחנה</h2>
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
