export type LatLng = { lat: number; lng: number };

export type TeamId = 'א' | 'ב';
/**
 * engine    — רכב כיבוי: 440 (צוות א), 406 (צוות ב), 402/401 בתחנות משנה
 * ladder    — 480 מנוף
 * tanker    — 490 אשד
 * commander — 41 מפקד משמרת, 475 סגן מפקד משמרת
 */
export type UnitType = 'engine' | 'ladder' | 'tanker' | 'commander';
export type CommanderRole = 'shift' | 'deputy';

export type VehicleStatus =
  | 'available' // זמין בתחנה
  | 'dispatched' // הוזנק, טרם יצא
  | 'enroute' // יצא / בדרך
  | 'onscene' // בזירה
  | 'cleared' // פנוי בזירה
  | 'returning' // חוזר לתחנה
  | 'offline'; // לא כשיר

/** תפקיד איש צוות ברכב — כפי שמוגדר בטאבלט */
export type CrewRole = 'commander' | 'driver' | 'firefighter';

export interface CrewMember {
  name: string;
  role: CrewRole;
}

export interface Team {
  id: TeamId;
  /** מספר הרכב שהצוות מאייש: 440 / 406 / 402 / 401 */
  unit: string;
  leader: string;
  crew: string[];
}

export interface Station {
  id: number;
  name: string;
  pos: LatLng;
  /** null = תחנה ראשית; אחרת — מזהה התחנה הראשית שתחנת המשנה שייכת אליה */
  parentId: number | null;
  /** סדר הצוותים בתחנה: ראשית ['א','ב'] (440/406), משנה ['א'] (402 או 401) */
  teamOrder: TeamId[];
  teams: Partial<Record<TeamId, Team>>;
  /** הצוות שבתור ליציאה הבאה (בתחנת משנה תמיד 'א') */
  turnTeam: TeamId;
  /** כוח אדם בתחנה שלא משובץ קבוע לצוות — זמין לשיבוץ מהטאבלט */
  reserve: string[];
}

export interface Vehicle {
  id: string;
  callsign: string;
  type: UnitType;
  stationId: number;
  /** רכב כיבוי — הצוות שמאייש אותו; מנוף/אשד/פיקוד — null (צוות עצמאי מחוץ לסבב) */
  homeTeam: TeamId | null;
  /** הצוות שמאייש כרגע (לרכב כיבוי = homeTeam) */
  crewTeam: TeamId | null;
  status: VehicleStatus;
  pos: LatLng;
  incidentId: string | null;
  /** זמן סימולציה (ms) שבו נכנס לסטטוס הנוכחי */
  statusSince: number;
  /** מספר הרכב בלי שם התחנה: '440', '475'… */
  unit: string;
  /** שם איש הצוות/המפקד שמוצג ליד הרכב */
  crewName?: string;
  /** לרכבי פיקוד */
  role?: CommanderRole;
  /** שיבוץ הצוות ברכב (מסך "צוות ברכב" בטאבלט) */
  crew: CrewMember[];
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

/** מדיה שהגיעה למוקד מהזירה — נוצרת כאיור סינתטי לפי seed (אין תמונות אמיתיות בהדמיה) */
export interface IncidentMedia {
  kind: 'photo' | 'video';
  seed: number;
  /** שניות, לסרטון */
  duration?: number;
}

/** עדכון שהמוקד קיבל ומעביר לכוחות: מהמדווח, מעוברי אורח, ממד״א, או מהמוקדן עצמו */
export interface IncidentUpdate {
  id: number;
  t: number;
  from: string;
  text: string;
  media?: IncidentMedia;
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
  updates: IncidentUpdate[];
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

/** ערוץ לכל תחנה ראשית (`st1`…`st6`); תחנות משנה משדרות בערוץ של התחנה הראשית */
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
  /** עדכוני זירה שעוד יגיעו למוקד (מדווחים שולחים תמונות אחרי כמה דקות) */
  pendingUpdates: { at: number; incidentId: string; from: string; text: string; media?: IncidentMedia }[];
  /** תגובות יחידות מתוזמנות (למשל לדיווח מצב) */
  pendingReplies: { at: number; channel: ChannelId; from: string; to?: string; text: string; incidentId?: string }[];
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
  /** המוקדן מעביר עדכון לכוחות (טקסט, ואפשר לצרף תמונה/סרטון שהתקבלו) */
  | { type: 'addUpdate'; incidentId: string; text: string; media?: IncidentMedia; from?: string }
  | { type: 'vehicleAction'; vehicleId: string; action: 'depart' | 'arrive' | 'clear' | 'home' | 'offline' | 'online' }
  | { type: 'ackDispatch'; dispatchId: string }
  | { type: 'setTurnTeam'; stationId: number; team: TeamId }
  | { type: 'setVehicleCrew'; vehicleId: string; crew: CrewMember[] }
  | { type: 'sendRadio'; channel: ChannelId; to: string; text: string; incidentId?: string }
  /** שידור מהרכב עצמו (טאבלט) למוקד בערוץ התחנה */
  | { type: 'unitRadio'; vehicleId: string; text: string }
  | { type: 'requestAmbulance'; incidentId: string }
  | { type: 'notifyPolice'; incidentId: string }
  | { type: 'setAutoDispatch'; value: boolean }
  | { type: 'setSpeed'; value: number }
  | { type: 'setPaused'; value: boolean }
  | { type: 'setCallRate'; value: CallRate }
  | { type: 'generateCall' }
  | { type: 'reset' };
