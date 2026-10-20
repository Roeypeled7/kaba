import type { ReactNode } from 'react';
import { AMB_STATUS_LABEL, CALL_RATE_LABEL, DISTRICT, INCIDENT_STATUS_LABEL, INCIDENT_TYPE, ROLE_LABEL, STATUS_LABEL, UNIT_LABEL } from '../engine/config';
import { STATIONS_GEO } from '../engine/geo';
import type { Ambulance, CallRate, Command, Incident, SimState, Station, TeamId, Vehicle } from '../engine/model';
import { unlockAudio, useAudioReady } from '../sound';

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('he-IL', { hour12: false });
export const fmtHM = (t: number) => new Date(t).toLocaleTimeString('he-IL', { hour12: false, hour: '2-digit', minute: '2-digit' });
export function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

export interface ScreenDef {
  path: string;
  title: string;
  short: string;
  desc?: string;
}

/** המסכים בלי תצוגה (#/dispatch וכו׳) — נשארים לקישורים ישנים */
export const SCREENS: ScreenDef[] = [
  { path: '/dispatch', title: 'קבלה ושיגור', short: 'שיגור' },
  { path: '/events', title: 'לוח אירועים', short: 'אירועים' },
  { path: '/comms', title: 'מערכת קשר', short: 'קשר' },
  { path: '/station/1', title: 'עמדות תחנה', short: 'תחנות' },
  { path: '/map', title: 'מפה', short: 'מפה' },
];

/* ── תצוגות: כל תצוגה היא סט מסכים לעמדה אחרת. נתיב: #/<תצוגה>/<מסך> ── */

export type ProfileId = '102' | 'ops';

export const PROFILES: Record<ProfileId, { title: string; short: string; accent: string; desc: string; screens: ScreenDef[] }> = {
  '102': {
    title: 'מרכז שליטה 102',
    short: '102',
    accent: '#ff6b35',
    desc: 'מענה לשיחות 102 — קבלת שיחה, פתיחת אירוע והזנקה, ומעקב אחרי האירועים עד הסיום',
    screens: [
      { path: '/map', title: 'מפה', short: 'מפה', desc: 'מפת מצב חיה — תחנות, רכבים בתנועה, אירועים, אמבולנסים ובתי חולים' },
      { path: '/dispatch', title: 'קבלה ושיגור', short: 'קבלה ושיגור', desc: 'שיחות נכנסות, פתיחת אירוע, המלצת כוחות והזנקה' },
      { path: '/events', title: 'לוח אירועים', short: 'אירועים', desc: 'לשיגור · הוזנק · במקום · פנויים · יציאה — כל האירועים לפי שלב' },
    ],
  },
  ops: {
    title: 'מרכז שיגור וניהול אירועים',
    short: 'שיגור וניהול',
    accent: '#4cc9f0',
    desc: 'ניהול הכוחות והאירועים שנפתחו — הזנקה, תחנות, תגבור וקשר מול היחידות',
    screens: [
      { path: '/map', title: 'מפה', short: 'מפה', desc: 'מפת מצב חיה — תחנות, רכבים בתנועה, אירועים, אמבולנסים ובתי חולים' },
      { path: '/station/1', title: 'עמדות תחנה', short: 'תחנות', desc: 'קבלת הזנקה בתחנה, תור צוותים, סטטוס רכבים' },
      { path: '/events', title: 'לוח אירועים', short: 'אירועים', desc: 'לשיגור · הוזנק · במקום · פנויים · יציאה — הזנקה ותגבור מהלוח' },
      { path: '/comms', title: 'מערכת קשר', short: 'קשר', desc: 'ערוצי קשר, תעבורה לפי אירוע, שידור ליחידות, תיאום מד״א ומשטרה' },
    ],
  },
};

export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];

/** '#/102/events' → { profile: '102', path: '/events' }. תצוגה בלי מסך → המסך הראשון שלה */
export function parseRoute(hash: string): { profile: ProfileId | null; path: string } {
  const m = hash.match(/^#\/(102|ops)(\/.*)?$/);
  if (!m) return { profile: null, path: hash.replace(/^#/, '') || '/' };
  const profile = m[1] as ProfileId;
  return { profile, path: !m[2] || m[2] === '/' ? PROFILES[profile].screens[0].path : m[2] };
}
export const routeHref = (profile: ProfileId | null, path: string) => (profile ? `#/${profile}${path}` : `#${path}`);
/** קישור למסך בתוך התצוגה הנוכחית */
export const hereHref = (path: string) => routeHref(parseRoute(location.hash).profile, path);

const isStation = (path: string) => path.startsWith('/station/');
const navOn = (path: string, current: string) => (isStation(path) ? isStation(current) : current === path);

/* ── מבנה המחוז ── */

/** סדר התצוגה של רכבי תחנה ראשית */
export const UNIT_ORDER = ['41', '475', '480', '490', '440', '406'];
const unitRank = (v: Vehicle) => {
  const i = UNIT_ORDER.indexOf(v.unit);
  return i < 0 ? 99 : i;
};
export const byUnit = (a: Vehicle, b: Vehicle) => unitRank(a) - unitRank(b);

export const STATION_ACCENT: Record<number, string> = {
  1: '#ff6b35',
  2: '#4cc9f0',
  3: '#f72585',
  4: '#ffd166',
  5: '#06d6a0',
  6: '#b388ff',
};

export const mainStations = (stations: Station[]) => stations.filter((s) => s.parentId === null).sort((a, b) => a.id - b.id);
export const subStations = (stations: Station[], mainId: number) => stations.filter((s) => s.parentId === mainId).sort((a, b) => a.id - b.id);
/** התחנה הראשית וכל תחנות המשנה שלה */
export const stationGroupIds = (stations: Station[], mainId: number) => new Set([mainId, ...subStations(stations, mainId).map((s) => s.id)]);

/** שם קצר: 'רחובות', 'יבנה' */
export function stationShort(st: Station): string {
  return STATIONS_GEO.find((g) => g.id === st.id)?.short ?? st.name.replace(/^תחנת\s*/, '');
}

/** מספר הרכב של הצוות שבתור: 440 / 406 */
export const turnUnit = (st: Station) => st.teams[st.turnTeam]?.unit ?? st.turnTeam;
export const teamUnit = (st: Station | undefined, team: TeamId | null) => (st && team ? st.teams[team]?.unit ?? team : null);

/** צוות נחשב בחוץ כל עוד רכב שהוא מאייש לא חזר לזמינות */
export function teamOut(vehicles: Vehicle[], stationId: number, team: TeamId): boolean {
  return vehicles.some(
    (v) => v.stationId === stationId && v.type !== 'commander' && v.crewTeam === team && v.status !== 'available' && v.status !== 'offline',
  );
}

/** הפעולה הבאה של רכב לפי הסטטוס שלו — משותף לעמדת התחנה ולטאבלט */
export const VEHICLE_ACTIONS: Partial<Record<Vehicle['status'], { action: 'depart' | 'arrive' | 'clear' | 'home' | 'offline' | 'online'; label: string; cls: string }>> = {
  dispatched: { action: 'depart', label: 'יצאנו', cls: 'fire' },
  enroute: { action: 'arrive', label: 'הגענו לזירה', cls: 'warn' },
  onscene: { action: 'clear', label: 'פנויים — חוזרים', cls: 'ok' },
  cleared: { action: 'clear', label: 'חוזרים לתחנה', cls: 'ok' },
  returning: { action: 'home', label: 'בתחנה', cls: 'ok' },
  available: { action: 'offline', label: 'לא כשיר', cls: 'ghost' },
  offline: { action: 'online', label: 'חזר לכשירות', cls: 'ok' },
};

/** מה שמוצג בעמודת הצוות: תפקיד ושם למפקד, שם איש הצוות לשאר */
export function crewLabel(v: Vehicle): string {
  if (v.type === 'commander') return [v.role ? ROLE_LABEL[v.role] : UNIT_LABEL.commander, v.crewName].filter(Boolean).join(' · ');
  return v.crewName ?? UNIT_LABEL[v.type];
}

/** בורר תחנה ראשית — מחליף את ה-hash */
export function StationPicker({ state, current }: { state: SimState; current: number }) {
  return (
    <label className="station-picker">
      <span>תחנה</span>
      <select value={current} onChange={(e) => (location.hash = hereHref(`/station/${e.target.value}`))}>
        {mainStations(state.stations).map((s) => (
          <option key={s.id} value={s.id}>
            {s.id} · {stationShort(s)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TopBar({ state, title, accent, children }: { state: SimState; title: string; accent?: string; children?: ReactNode }) {
  const { profile, path } = parseRoute(location.hash);
  const screens = profile ? PROFILES[profile].screens : SCREENS;
  return (
    <header className="topbar" style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}>
      <div className="topbar-title">
        <span className="logo">🚒</span>
        <div>
          <div className="t1">{title}</div>
          <div className="t2">{profile ? `${PROFILES[profile].title} · ${DISTRICT.name}` : DISTRICT.name}</div>
        </div>
      </div>
      <nav className="topnav">
        <a href="#/">⌂</a>
        {screens.map((s) => (
          <a key={s.path} href={routeHref(profile, s.path)} className={navOn(s.path, path) ? 'on' : ''}>
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
