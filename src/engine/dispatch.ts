import { HOSPITALS } from './geo';
import { INCIDENT_TYPE } from './config';
import type { Assignment, LatLng, SimState, Station, TeamId, UnitType, Vehicle } from './model';

export type Need = Partial<Record<UnitType, number>>;

/** יחידות עצמאיות (מחוץ לסבב הצוותים) שנבחרות לפי הרכב הזמין הקרוב */
const INDEPENDENT_UNITS: UnitType[] = ['ladder', 'tanker'];
const DEFAULT_ORDER: TeamId[] = ['א', 'ב'];

export function distKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** התחנה הראשית שתחנה שייכת אליה (לתחנה ראשית — היא עצמה). קובע את ערוץ הקשר. */
export const mainStationId = (s: { id: number; parentId: number | null }) => s.parentId ?? s.id;

/** בית החולים הקרוב לנקודה */
export function nearestHospital(pos: LatLng): { name: string; pos: LatLng } {
  return HOSPITALS.reduce((best, h) => (distKm(h.pos, pos) < distKm(best.pos, pos) ? h : best));
}

/** הצוות הבא בסדר הצוותים של התחנה. בתחנה עם צוות אחד — אותו צוות. */
export const otherTeam = (t: TeamId, order: TeamId[] = DEFAULT_ORDER): TeamId => {
  const i = order.indexOf(t);
  if (i < 0) return order[0] ?? t;
  return order[(i + 1) % order.length];
};

/** דרישת כוחות לפי סוג אירוע וחומרה */
export function requirement(typeKey: string, severity: number): Need {
  const t = INCIDENT_TYPE[typeKey];
  const out: Need = { ...t.req };
  for (const [k, n] of Object.entries(t.perLevel) as [UnitType, number][]) out[k] = (out[k] ?? 0) + n * (severity - 1);
  return out;
}

/** צוות נחשב בחוץ כל עוד רכב הכיבוי שהוא מאייש לא חזר לזמינות */
export function teamBusy(vehicles: Vehicle[], stationId: number, team: TeamId): boolean {
  return vehicles.some(
    (v) => v.stationId === stationId && v.type === 'engine' && v.crewTeam === team && v.status !== 'available' && v.status !== 'offline',
  );
}

/** סדר העדיפות של הצוותים לפי התור: הצוות שבתור, ואחריו שאר הצוותים לפי סדר התחנה — בלי הצוותים שבחוץ */
export function teamCandidates(turnTeam: TeamId, busy: Set<TeamId>, order: TeamId[] = DEFAULT_ORDER): TeamId[] {
  const start = Math.max(0, order.indexOf(turnTeam));
  const rotated = [...order.slice(start), ...order.slice(0, start)];
  return rotated.filter((t) => !busy.has(t));
}

/** הצוות שבתור אחרי יציאה: יצא הצוות שבתור → התור עובר; יצא אחר במקומו → התור נשאר */
export function nextTurn(turnTeam: TeamId, dispatched: TeamId, order: TeamId[] = DEFAULT_ORDER): TeamId {
  return dispatched === turnTeam ? otherTeam(turnTeam, order) : turnTeam;
}

export interface Recommendation {
  assignments: Assignment[];
  shortage: Need;
}

/**
 * המלצת כוחות:
 * - רכבי כיבוי: תחנות (ראשיות ומשנה) לפי מרחק. סבב ראשון — צוות אחד מכל תחנה, סבב שני — צוותים נוספים.
 * - מנוף/אשד: הרכב הזמין הקרוב (צוות עצמאי, מחוץ לסבב).
 * - מפקד: 475 הקרוב, ואם אין — 41. חומרה 3 מוסיפה גם 41 הקרוב.
 * @param incidentId אם ניתן — לא מוסיפים 41 בחומרה 3 כשכבר יש מפקד משמרת פעיל באירוע.
 */
export function recommend(
  state: Pick<SimState, 'stations' | 'vehicles'>,
  pos: LatLng,
  needIn: Need,
  severity = 1,
  incidentId?: string,
): Recommendation {
  const need: Need = { ...needIn };
  const used = new Set<string>();
  const assignments: Assignment[] = [];
  const avail = (v: Vehicle) => v.status === 'available' && !used.has(v.id);
  const byDist = (a: Vehicle, b: Vehicle) => distKm(a.pos, pos) - distKm(b.pos, pos);
  const take = (v: Vehicle, team: TeamId | null, countAs?: UnitType) => {
    used.add(v.id);
    if (countAs) need[countAs] = (need[countAs] ?? 0) - 1;
    assignments.push({ vehicleId: v.id, stationId: v.stationId, team });
  };

  // רכבי כיבוי — לפי סבב הצוותים
  const busy = new Map<number, Set<TeamId>>();
  const turn = new Map<number, TeamId>();
  for (const st of state.stations) {
    busy.set(st.id, new Set(st.teamOrder.filter((t) => teamBusy(state.vehicles, st.id, t))));
    turn.set(st.id, st.turnTeam);
  }
  const stations = [...state.stations].sort((a, b) => distKm(a.pos, pos) - distKm(b.pos, pos));
  const engineNeedLeft = () => (need.engine ?? 0) > 0;

  const tryStation = (st: Station): boolean => {
    for (const team of teamCandidates(turn.get(st.id)!, busy.get(st.id)!, st.teamOrder)) {
      const eng = state.vehicles.find((v) => v.stationId === st.id && v.type === 'engine' && v.homeTeam === team && avail(v));
      if (!eng) continue;
      take(eng, team, 'engine');
      busy.get(st.id)!.add(team);
      turn.set(st.id, nextTurn(turn.get(st.id)!, team, st.teamOrder));
      return true;
    }
    return false;
  };

  for (const st of stations) {
    if (!engineNeedLeft()) break;
    tryStation(st);
  }
  for (const st of stations) {
    while (engineNeedLeft() && tryStation(st));
  }

  // מנוף / אשד — הקרוב הזמין
  for (const t of INDEPENDENT_UNITS) {
    const pool = state.vehicles.filter((v) => v.type === t && avail(v)).sort(byDist);
    for (const v of pool) {
      if ((need[t] ?? 0) <= 0) break;
      take(v, null, t);
    }
  }

  // מפקדים: סגן מפקד משמרת קודם, אחריו מפקד משמרת
  const commanders = state.vehicles.filter((v) => v.type === 'commander' && avail(v)).sort(byDist);
  const ordered = [...commanders.filter((v) => v.role === 'deputy'), ...commanders.filter((v) => v.role !== 'deputy')];
  for (const c of ordered) {
    if ((need.commander ?? 0) <= 0) break;
    take(c, null, 'commander');
  }
  if (severity >= 3) {
    const shiftOnIncident =
      incidentId !== undefined &&
      state.vehicles.some((v) => v.incidentId === incidentId && v.role === 'shift' && v.status !== 'available' && v.status !== 'returning');
    const alreadyPicked = assignments.some((a) => state.vehicles.find((v) => v.id === a.vehicleId)?.role === 'shift');
    if (!shiftOnIncident && !alreadyPicked) {
      const shift = commanders.find((v) => v.role === 'shift' && avail(v));
      if (shift) take(shift, null);
    }
  }

  const shortage: Need = {};
  for (const [k, n] of Object.entries(need) as [UnitType, number][]) if (n > 0) shortage[k] = n;
  return { assignments, shortage };
}

/** שיוך צוותים לבחירה ידנית של רכבים: רכב כיבוי — הצוות שלו; כל השאר — צוות עצמאי (null) */
export function assignTeams(state: Pick<SimState, 'stations' | 'vehicles'>, vehicleIds: string[]): Assignment[] {
  return vehicleIds
    .map((id) => state.vehicles.find((v) => v.id === id))
    .filter((v): v is Vehicle => !!v)
    .map((v) => ({ vehicleId: v.id, stationId: v.stationId, team: v.type === 'engine' ? v.homeTeam : null }));
}

/** החלת רוטציה על התחנות לפי סדר היציאות בהזנקה */
export function applyRotation(stations: Station[], assignments: Assignment[]): void {
  const seen = new Set<string>();
  for (const a of assignments) {
    if (!a.team) continue;
    const key = `${a.stationId}:${a.team}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const st = stations.find((s) => s.id === a.stationId);
    if (st) st.turnTeam = nextTurn(st.turnTeam, a.team, st.teamOrder);
  }
}

export function needDelta(a: Need, b: Need): Need {
  const out: Need = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<UnitType>) {
    const d = (b[k] ?? 0) - (a[k] ?? 0);
    if (d > 0) out[k] = d;
  }
  return out;
}
