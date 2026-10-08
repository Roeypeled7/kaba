import { INCIDENT_TYPE } from './config';
import type { Assignment, LatLng, SimState, Station, TeamId, UnitType, Vehicle } from './model';

export type Need = Partial<Record<UnitType, number>>;

export const DISTRICT_OFFICER_ID = 'C01';
const TEAM_UNITS: UnitType[] = ['engine', 'tanker', 'rescue'];
const SHARED_UNITS: UnitType[] = ['tanker', 'rescue'];

export function distKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const otherTeam = (t: TeamId): TeamId => (t === 'א' ? 'ב' : 'א');

/** דרישת כוחות לפי סוג אירוע וחומרה */
export function requirement(typeKey: string, severity: number): Need {
  const t = INCIDENT_TYPE[typeKey];
  const out: Need = { ...t.req };
  for (const [k, n] of Object.entries(t.perLevel) as [UnitType, number][]) out[k] = (out[k] ?? 0) + n * (severity - 1);
  return out;
}

/** צוות נחשב בחוץ כל עוד רכב כלשהו שהוא מאייש לא חזר לזמינות */
export function teamBusy(vehicles: Vehicle[], stationId: number, team: TeamId): boolean {
  return vehicles.some(
    (v) => v.stationId === stationId && v.type !== 'commander' && v.crewTeam === team && v.status !== 'available' && v.status !== 'offline',
  );
}

/** סדר העדיפות של הצוותים לפי התור: הצוות שבתור, ואם הוא בחוץ — השני */
export function teamCandidates(turnTeam: TeamId, busy: Set<TeamId>): TeamId[] {
  return [turnTeam, otherTeam(turnTeam)].filter((t) => !busy.has(t));
}

/** הצוות שבתור אחרי יציאה: יצא הצוות שבתור → התור עובר; יצא השני במקומו → התור נשאר */
export function nextTurn(turnTeam: TeamId, dispatched: TeamId): TeamId {
  return dispatched === turnTeam ? otherTeam(turnTeam) : turnTeam;
}

export interface Recommendation {
  assignments: Assignment[];
  shortage: Need;
}

/**
 * המלצת כוחות: תחנות לפי מרחק. סבב ראשון — צוות אחד מכל תחנה (פיזור עומס),
 * סבב שני — צוות נוסף מתחנות שעדיין יש בהן צוות פנוי. מפקדים לפי קרבה.
 */
export function recommend(state: Pick<SimState, 'stations' | 'vehicles'>, pos: LatLng, needIn: Need, severity = 1): Recommendation {
  const need: Need = { ...needIn };
  const used = new Set<string>();
  const assignments: Assignment[] = [];
  const avail = (v: Vehicle) => v.status === 'available' && !used.has(v.id);

  const busy = new Map<number, Set<TeamId>>();
  const turn = new Map<number, TeamId>();
  for (const st of state.stations) {
    busy.set(st.id, new Set((['א', 'ב'] as TeamId[]).filter((t) => teamBusy(state.vehicles, st.id, t))));
    turn.set(st.id, st.turnTeam);
  }
  const stations = [...state.stations].sort((a, b) => distKm(a.pos, pos) - distKm(b.pos, pos));
  const teamNeedLeft = () => TEAM_UNITS.some((t) => (need[t] ?? 0) > 0);

  const tryStation = (st: Station): boolean => {
    for (const team of teamCandidates(turn.get(st.id)!, busy.get(st.id)!)) {
      const contrib: Vehicle[] = [];
      if ((need.engine ?? 0) > 0) {
        const eng = state.vehicles.find((v) => v.stationId === st.id && v.type === 'engine' && v.homeTeam === team && avail(v));
        if (eng) contrib.push(eng);
      }
      for (const t of SHARED_UNITS) {
        if ((need[t] ?? 0) <= 0) continue;
        const sv = state.vehicles.find((v) => v.stationId === st.id && v.type === t && avail(v));
        if (sv) contrib.push(sv);
      }
      if (!contrib.length) continue;
      for (const v of contrib) {
        used.add(v.id);
        need[v.type] = (need[v.type] ?? 0) - 1;
        assignments.push({ vehicleId: v.id, stationId: st.id, team });
      }
      busy.get(st.id)!.add(team);
      turn.set(st.id, nextTurn(turn.get(st.id)!, team));
      return true;
    }
    return false;
  };

  for (const st of stations) {
    if (!teamNeedLeft()) break;
    tryStation(st);
  }
  for (const st of stations) {
    while (teamNeedLeft() && tryStation(st));
  }

  // מפקדים
  const commanders = state.vehicles
    .filter((v) => v.type === 'commander' && avail(v))
    .sort((a, b) => distKm(a.pos, pos) - distKm(b.pos, pos));
  if (severity >= 3) {
    const dist = commanders.find((v) => v.id === DISTRICT_OFFICER_ID);
    if (dist) {
      used.add(dist.id);
      assignments.push({ vehicleId: dist.id, stationId: dist.stationId, team: null });
    }
  }
  const stationCmd = [...commanders.filter((v) => v.id !== DISTRICT_OFFICER_ID), ...commanders.filter((v) => v.id === DISTRICT_OFFICER_ID)];
  for (const c of stationCmd) {
    if ((need.commander ?? 0) <= 0) break;
    if (!avail(c)) continue;
    used.add(c.id);
    need.commander = (need.commander ?? 0) - 1;
    assignments.push({ vehicleId: c.id, stationId: c.stationId, team: null });
  }

  const shortage: Need = {};
  for (const [k, n] of Object.entries(need) as [UnitType, number][]) if (n > 0) shortage[k] = n;
  return { assignments, shortage };
}

/** שיוך צוותים לבחירה ידנית של רכבים (ללא המלצה) */
export function assignTeams(state: Pick<SimState, 'stations' | 'vehicles'>, vehicleIds: string[]): Assignment[] {
  const out: Assignment[] = [];
  const chosen = new Map<number, TeamId>();
  const vs = vehicleIds.map((id) => state.vehicles.find((v) => v.id === id)!).filter(Boolean);
  for (const v of vs.filter((v) => v.type === 'engine')) {
    out.push({ vehicleId: v.id, stationId: v.stationId, team: v.homeTeam });
    if (!chosen.has(v.stationId) && v.homeTeam) chosen.set(v.stationId, v.homeTeam);
  }
  for (const v of vs.filter((v) => v.type !== 'engine')) {
    if (v.type === 'commander') {
      out.push({ vehicleId: v.id, stationId: v.stationId, team: null });
      continue;
    }
    let team = chosen.get(v.stationId);
    if (!team) {
      const st = state.stations.find((s) => s.id === v.stationId)!;
      const busy = new Set((['א', 'ב'] as TeamId[]).filter((t) => teamBusy(state.vehicles, st.id, t)));
      team = teamCandidates(st.turnTeam, busy)[0];
      if (!team) continue;
      chosen.set(v.stationId, team);
    }
    out.push({ vehicleId: v.id, stationId: v.stationId, team });
  }
  return out;
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
    if (st) st.turnTeam = nextTurn(st.turnTeam, a.team);
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
