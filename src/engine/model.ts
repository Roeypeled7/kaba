export type LatLng = { lat: number; lng: number };

export type TeamId = 'א' | 'ב';
export type UnitType = 'engine' | 'tanker' | 'rescue' | 'commander';

export type VehicleStatus =
  | 'available' // זמין בתחנה
  | 'dispatched' // הוזנק, טרם יצא
  | 'enroute' // יצא / בדרך
  | 'onscene' // בזירה
  | 'cleared' // פנוי בזירה
  | 'returning' // חוזר לתחנה
  | 'offline'; // לא כשיר

export interface Team {
  id: TeamId;
  leader: string;
  crew: string[];
}

export interface Station {
  id: number;
  name: string;
  pos: LatLng;
  /** תחנה שמופיעה כמסך עמדה בהדמיה */
  onScreen: boolean;
  teams: Record<TeamId, Team>;
  /** הצוות שבתור ליציאה הבאה */
  turnTeam: TeamId;
}

export interface Vehicle {
  id: string;
  callsign: string;
  type: UnitType;
  stationId: number;
  /** צוות קבוע (רביעייה), או null לרכב משותף/פיקוד */
  homeTeam: TeamId | null;
  /** הצוות שמאייש כרגע (נקבע בהזנקה) */
  crewTeam: TeamId | null;
  status: VehicleStatus;
  pos: LatLng;
  incidentId: string | null;
  /** זמן סימולציה (ms) שבו נכנס לסטטוס הנוכחי */
  statusSince: number;
  /** לרכבי פיקוד — שם המפקד */
  commanderName?: string;
}

export type AmbulanceStatus = 'available' | 'enroute' | 'onscene' | 'transporting' | 'returning';

export interface Ambulance {
  id: string;
  callsign: string;
  base: LatLng;
  baseName: string;
  pos: LatLng;
  status: AmbulanceStatus;
  incidentId: string | null;
  statusSince: number;
}

export type IncidentStatus = 'new' | 'dispatched' | 'active' | 'controlled' | 'closed';

export interface Incident {
  id: string;
  typeKey: string;
  severity: 1 | 2 | 3;
  address: string;
  pos: LatLng;
  caller: string;
  phone: string;
  notes: string;
  status: IncidentStatus;
  openedAt: number;
  closedAt: number | null;
  /** שניות סימולציה של עבודה שנותרו עד שליטה */
  workLeft: number;
  /** כל הרכבים שהוזנקו לאירוע אי־פעם */
  vehicleIds: string[];
  ambulanceIds: string[];
  ambulanceRequested: boolean;
  policeNotified: boolean;
  /** דרישה שלא מולאה (חוסר כוחות) */
  shortage: Partial<Record<UnitType, number>>;
  log: { t: number; text: string }[];
}

export interface IncomingCall {
  id: string;
  t: number;
  caller: string;
  phone: string;
  typeKey: string;
  addressIdx: number;
  description: string;
}

export interface Assignment {
  vehicleId: string;
  stationId: number;
  team: TeamId | null;
}

export interface StationDispatch {
  id: string;
  stationId: number;
  incidentId: string;
  team: TeamId | null;
  vehicleIds: string[];
  t: number;
  ack: boolean;
}

export type ChannelId = 'district' | 'mda' | 'police' | `st${number}`;

export interface RadioMsg {
  id: number;
  t: number;
  channel: ChannelId;
  from: string;
  to: string;
  text: string;
  incidentId?: string;
  /** הודעה שיצאה מהמוקד */
  outgoing?: boolean;
}

export type CallRate = 'off' | 'low' | 'med' | 'high';

export interface SimState {
  version: number;
  simTime: number;
  speed: number;
  paused: boolean;
  autoDispatch: boolean;
  callRate: CallRate;
  nextCallAt: number;
  seq: number;
  stations: Station[];
  vehicles: Vehicle[];
  ambulances: Ambulance[];
  incidents: Incident[];
  calls: IncomingCall[];
  dispatches: StationDispatch[];
  radio: RadioMsg[];
  /** בקשות מד״א שממתינות לתשובה: incidentId → זמן תשובה */
  mdaPending: { incidentId: string; at: number }[];
  /** תגובות יחידות מתוזמנות (למשל לדיווח מצב) */
  pendingReplies: { at: number; channel: ChannelId; from: string; text: string; incidentId?: string }[];
}

export type Command =
  | {
      type: 'openIncident';
      callId?: string;
      typeKey: string;
      severity: 1 | 2 | 3;
      address: string;
      pos: LatLng;
      caller: string;
      phone: string;
      notes: string;
    }
  | { type: 'dropCall'; callId: string }
  | { type: 'dispatchRecommended'; incidentId: string }
  | { type: 'dispatchUnits'; incidentId: string; vehicleIds: string[] }
  | { type: 'reinforce'; incidentId: string; unitType: UnitType }
  | { type: 'setSeverity'; incidentId: string; severity: 1 | 2 | 3 }
  | { type: 'releaseUnit'; vehicleId: string }
  | { type: 'closeIncident'; incidentId: string }
  | { type: 'vehicleAction'; vehicleId: string; action: 'depart' | 'arrive' | 'clear' | 'home' | 'offline' | 'online' }
  | { type: 'ackDispatch'; dispatchId: string }
  | { type: 'setTurnTeam'; stationId: number; team: TeamId }
  | { type: 'sendRadio'; channel: ChannelId; to: string; text: string; incidentId?: string }
  | { type: 'requestAmbulance'; incidentId: string }
  | { type: 'notifyPolice'; incidentId: string }
  | { type: 'setAutoDispatch'; value: boolean }
  | { type: 'setSpeed'; value: number }
  | { type: 'setPaused'; value: boolean }
  | { type: 'setCallRate'; value: CallRate }
  | { type: 'generateCall' }
  | { type: 'reset' };
