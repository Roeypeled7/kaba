import type { ReactNode } from 'react';
import { AMB_STATUS_LABEL, CALL_RATE_LABEL, DISTRICT, INCIDENT_STATUS_LABEL, INCIDENT_TYPE, STATUS_LABEL } from '../engine/config';
import type { Ambulance, CallRate, Command, Incident, SimState, Vehicle } from '../engine/model';
import { unlockAudio, useAudioReady } from '../sound';

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('he-IL', { hour12: false });
export const fmtHM = (t: number) => new Date(t).toLocaleTimeString('he-IL', { hour12: false, hour: '2-digit', minute: '2-digit' });
export function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

export const SCREENS = [
  { hash: '#/dispatch', title: 'קבלה ושיגור', short: 'שיגור' },
  { hash: '#/comms', title: 'מערכת קשר', short: 'קשר' },
  { hash: '#/station/1', title: 'תחנה 1', short: 'תחנה 1' },
  { hash: '#/station/2', title: 'תחנה 2', short: 'תחנה 2' },
  { hash: '#/map', title: 'מפה', short: 'מפה' },
];

export function TopBar({ state, title, accent, children }: { state: SimState; title: string; accent?: string; children?: ReactNode }) {
  return (
    <header className="topbar" style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}>
      <div className="topbar-title">
        <span className="logo">🚒</span>
        <div>
          <div className="t1">{title}</div>
          <div className="t2">{DISTRICT.name}</div>
        </div>
      </div>
      <nav className="topnav">
        <a href="#/">⌂</a>
        {SCREENS.map((s) => (
          <a key={s.hash} href={s.hash} className={location.hash === s.hash ? 'on' : ''}>
            {s.short}
          </a>
        ))}
      </nav>
      <div className="topbar-end">
        {children}
        <SoundToggle />
        <div className={`clock ${state.paused ? 'paused' : ''}`}>
          <span className="mono">{fmtTime(state.simTime)}</span>
          <span className="speed">{state.paused ? 'מושהה' : `×${state.speed}`}</span>
        </div>
      </div>
    </header>
  );
}

export function SoundToggle() {
  const ready = useAudioReady();
  return (
    <button className={`btn ghost sm ${ready ? '' : 'pulse-soft'}`} onClick={() => unlockAudio()} title="דפדפנים חוסמים צליל עד לחיצה ראשונה">
      {ready ? '🔊 צליל פעיל' : '🔈 הפעל צליל'}
    </button>
  );
}

export function StatusChip({ v, big }: { v: Vehicle; big?: boolean }) {
  return <span className={`chip st-${v.status} ${big ? 'big' : ''}`}>{STATUS_LABEL[v.status]}</span>;
}

export function AmbChip({ a }: { a: Ambulance }) {
  return <span className={`chip amb-${a.status}`}>{AMB_STATUS_LABEL[a.status]}</span>;
}

export function IncidentBadge({ inc }: { inc: Incident }) {
  return <span className={`chip inc-${inc.status}`}>{INCIDENT_STATUS_LABEL[inc.status]}</span>;
}

export function IncidentTitle({ inc }: { inc: Incident }) {
  const t = INCIDENT_TYPE[inc.typeKey];
  return (
    <span className="inc-title">
      <span className="mono dim">#{inc.id}</span> {t.icon} {t.label}
      <span className={`sev sev-${inc.severity}`}>חומרה {inc.severity}</span>
    </span>
  );
}

export function UnitTag({ v, onClick }: { v: Vehicle; onClick?: () => void }) {
  return (
    <span className={`unit-tag st-${v.status}`} onClick={onClick} title={STATUS_LABEL[v.status]}>
      {v.callsign}
      {v.crewTeam && v.type !== 'commander' ? <small> · {v.crewTeam}</small> : null}
    </span>
  );
}

export function SimControls({ state, send, compact }: { state: SimState; send: (c: Command) => void; compact?: boolean }) {
  return (
    <div className={`sim-controls ${compact ? 'compact' : ''}`}>
      <label className="toggle">
        <input type="checkbox" checked={state.autoDispatch} onChange={(e) => send({ type: 'setAutoDispatch', value: e.target.checked })} />
        <span>שיגור אוטומטי</span>
      </label>
      <div className="seg">
        {[1, 5, 10, 20].map((n) => (
          <button key={n} className={state.speed === n ? 'on' : ''} onClick={() => send({ type: 'setSpeed', value: n })}>
            ×{n}
          </button>
        ))}
      </div>
      <button className="btn sm" onClick={() => send({ type: 'setPaused', value: !state.paused })}>
        {state.paused ? '▶ המשך' : '⏸ השהה'}
      </button>
      <label className="field-inline">
        קריאות:
        <select value={state.callRate} onChange={(e) => send({ type: 'setCallRate', value: e.target.value as CallRate })}>
          {(Object.keys(CALL_RATE_LABEL) as CallRate[]).map((k) => (
            <option key={k} value={k}>
              {CALL_RATE_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <button className="btn sm" onClick={() => send({ type: 'generateCall' })}>
        ☎ קריאה עכשיו
      </button>
    </div>
  );
}

export function Loading() {
  return <div className="loading">מתחבר למנוע ההדמיה…</div>;
}
