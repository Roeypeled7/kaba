import { INCIDENT_TYPE, STATUS_LABEL, UNIT_LABEL } from '../../engine/config';
import { byUnit, fmtElapsed, stationGroupIds, stationShort } from '../../components/ui';
import { mainStationId } from '../../engine/dispatch';
import { daysLeft, openFaults, useChecks } from './Checks';
import type { Ctx } from './shared';

const HOUR = 3_600_000;
const SHIFT_H = 12;

export default function Dashboard({ state, v, st }: Ctx) {
  const now = state.simTime;
  const shiftStart = now - SHIFT_H * HOUR;
  const { data } = useChecks(v, now);
  const mainId = mainStationId(st);
  const group = stationGroupIds(state.stations, mainId);
  const main = state.stations.find((s) => s.id === mainId)!;

  const myInc = state.incidents.filter((i) => i.vehicleIds.includes(v.id) && i.openedAt >= shiftStart);
  const groupVeh = state.vehicles.filter((x) => group.has(x.stationId)).sort((a, b) => a.stationId - b.stationId || byUnit(a, b));
  const ready = groupVeh.filter((x) => x.status === 'available').length;
  const active = state.incidents.filter((i) => i.status !== 'closed');
  const engines = state.vehicles.filter((x) => x.type === 'engine');
  const enginesFree = engines.filter((x) => x.status === 'available').length;
  const late = (['weekly', 'semi'] as const).filter((k) => daysLeft(data, k, now) < 0).length;

  // יציאות של התחנה לפי שעה, 12 השעות האחרונות
  const buckets = Array.from({ length: SHIFT_H }, (_, i) => {
    const from = shiftStart + i * HOUR;
    return {
      h: new Date(from + HOUR).getHours(),
      n: state.dispatches.filter((d) => group.has(d.stationId) && d.t >= from && d.t < from + HOUR).length,
    };
  });
  const maxN = Math.max(1, ...buckets.map((b) => b.n));

  const kpis = [
    { v: myInc.length, l: 'יציאות במשמרת' },
    { v: STATUS_LABEL[v.status], l: `סטטוס · ${fmtElapsed(now - v.statusSince)}`, cls: `st-${v.status}` },
    { v: `${ready}/${groupVeh.length}`, l: `זמינים ב${stationShort(main)}` },
    { v: active.length, l: 'אירועים פעילים במחוז', warn: active.length > 3 },
    { v: `${enginesFree}/${engines.length}`, l: 'רכבי כיבוי זמינים במחוז' },
    { v: openFaults(data).length, l: 'תקלות פתוחות', warn: openFaults(data).some((f) => f.critical) },
    { v: late, l: 'בדיקות באיחור', warn: late > 0 },
    { v: v.crew.length, l: 'אנשי צוות ברכב' },
  ];

  return (
    <div className="mdt-page">
      <div className="mdt-kpis">
        {kpis.map((k) => (
          <div key={k.l} className={`mdt-kpi ${k.warn ? 'warn' : ''}`}>
            <b className={k.cls}>{k.v}</b>
            <span>{k.l}</span>
          </div>
        ))}
      </div>
      <div className="mdt-split">
        <section className="mdt-panel grow">
          <div className="mdt-panel-h">יציאות {stationShort(main)} — 12 שעות אחרונות</div>
          <div className="mdt-bars">
            {buckets.map((b, i) => (
              <div key={i}>
                <span className="mono">{b.n || ''}</span>
                <i style={{ height: `${(b.n / maxN) * 100}%` }} />
                <em className="mono">{String(b.h).padStart(2, '0')}</em>
              </div>
            ))}
          </div>
          <div className="mdt-panel-h small">היציאות שלי במשמרת</div>
          <div className="mdt-scroll mdt-log">
            {!myInc.length && <div className="mdt-empty">אין יציאות במשמרת</div>}
            {[...myInc].reverse().map((i) => (
              <div key={i.id}>
                <span className="mono dim">#{i.id}</span> {INCIDENT_TYPE[i.typeKey].icon} {INCIDENT_TYPE[i.typeKey].label} · {i.address}
              </div>
            ))}
          </div>
        </section>
        <section className="mdt-panel side">
          <div className="mdt-panel-h">מצב רכבי {stationShort(main)}</div>
          <div className="mdt-scroll mdt-forces">
            {groupVeh.map((x) => (
              <div key={x.id} className={x.id === v.id ? 'me' : ''}>
                <b className="mono">{x.unit}</b>
                <span className="grow">
                  {UNIT_LABEL[x.type]}
                  {x.stationId !== mainId && <span className="dim"> · {stationShort(state.stations.find((s) => s.id === x.stationId)!)}</span>}
                </span>
                <span className={`mdt-stdot st-${x.status}`}>{STATUS_LABEL[x.status]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
