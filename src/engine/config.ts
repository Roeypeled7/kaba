import type { LatLng, Station, UnitType, Vehicle, Ambulance, VehicleStatus, AmbulanceStatus, IncidentStatus, CallRate, CommanderRole, CrewMember, CrewRole, TeamId } from './model';
import { ADDRESSES_GEO, DISTRICT_GEO, HOSPITALS, MDA_BASES, STATIONS_GEO } from './geo';

/** כל המיקומים מגיעים מ-geo.ts */
export const DISTRICT = {
  name: 'מחוז מרכז',
  center: DISTRICT_GEO.center,
  zoom: DISTRICT_GEO.zoom,
  hospitals: HOSPITALS,
};

export const DEFAULT_SPEED = 5;

export const UNIT_LABEL: Record<UnitType, string> = {
  engine: 'רכב כיבוי',
  ladder: 'מנוף',
  tanker: 'אשד',
  commander: 'מפקד',
};

export const CREW_ROLE_LABEL: Record<CrewRole, string> = {
  commander: 'מפקד צוות',
  driver: 'נהג',
  firefighter: 'לוחם אש',
};

export const ROLE_LABEL: Record<CommanderRole, string> = {
  shift: 'מפקד משמרת',
  deputy: 'סגן מפקד משמרת',
};

/** מהירות ממוצעת בקמ״ש (נסיעה בין־עירונית) */
export const UNIT_SPEED_KMH: Record<UnitType, number> = {
  engine: 70,
  tanker: 60,
  ladder: 55,
  commander: 85,
};
export const AMBULANCE_SPEED_KMH = 75;

/** זמני סימולציה (שניות) */
export const TIMING = {
  turnout: 60, // מהזנקה ועד יציאה
  clearedToReturn: 45, // פנוי בזירה → חוזר
  ambulanceOnScene: 420,
  ambulanceAtHospital: 600,
  mdaReply: [15, 35] as [number, number],
};

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  available: 'זמין',
  dispatched: 'הוזנק',
  enroute: 'בדרך',
  onscene: 'בזירה',
  cleared: 'פנוי בזירה',
  returning: 'חוזר',
  offline: 'לא כשיר',
};

export const AMB_STATUS_LABEL: Record<AmbulanceStatus, string> = {
  available: 'זמין',
  enroute: 'בדרך',
  onscene: 'בזירה',
  transporting: 'מפנה לבי״ח',
  returning: 'חוזר לבסיס',
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  new: 'פתוח — לא שוגר',
  dispatched: 'שוגר',
  active: 'בטיפול',
  controlled: 'נשלט',
  closed: 'הסתיים',
};

export interface IncidentType {
  key: string;
  label: string;
  icon: string;
  /** דרישת כוחות בחומרה 1 */
  req: Partial<Record<UnitType, number>>;
  /** תוספת לכל דרגת חומרה מעל 1 */
  perLevel: Partial<Record<UnitType, number>>;
  /** דקות עבודה בזירה בחומרה 1 */
  workMin: number;
  ambulance: boolean;
  police: boolean;
  descriptions: string[];
  weight: number;
}

export const INCIDENT_TYPES: IncidentType[] = [
  {
    key: 'structure',
    label: 'שריפת מבנה',
    icon: '🔥',
    req: { engine: 2, ladder: 1, commander: 1 },
    perLevel: { engine: 1, tanker: 1 },
    workMin: 25,
    ambulance: false,
    police: true,
    descriptions: ['עשן סמיך יוצא מחלון בקומה שלישית', 'אש בדירה, דיירים יצאו לחדר המדרגות', 'שריפה במחסן מאחורי הבניין', 'ריח שרוף ועשן מהלובי'],
    weight: 3,
  },
  {
    key: 'vehicle',
    label: 'שריפת רכב',
    icon: '🚗',
    req: { engine: 1 },
    perLevel: { engine: 1 },
    workMin: 10,
    ambulance: false,
    police: false,
    descriptions: ['רכב עולה באש בחניה', 'עשן ממנוע של רכב בשול הכביש', 'אוטובוס עם אש בתא המנוע'],
    weight: 3,
  },
  {
    key: 'brush',
    label: 'שריפת קוצים / חורש',
    icon: '🌾',
    req: { engine: 1, tanker: 1 },
    perLevel: { engine: 1, tanker: 1 },
    workMin: 20,
    ambulance: false,
    police: false,
    descriptions: ['שריפת קוצים ליד הכביש מתקדמת עם הרוח', 'אש בשטח פתוח ליד הבתים', 'עשן מחורשה, נראות להבות'],
    weight: 3,
  },
  {
    key: 'mva',
    label: 'תאונת דרכים — לכודים',
    icon: '🚑',
    req: { engine: 2, commander: 1 },
    perLevel: { engine: 1 },
    workMin: 30,
    ambulance: true,
    police: true,
    descriptions: ['התנגשות חזיתית, נהג לכוד ברכב', 'רכב התהפך, יש לכודים', 'משאית ורכב פרטי, נוסעת לכודה'],
    weight: 2,
  },
  {
    key: 'hazmat',
    label: 'אירוע חומ״ס',
    icon: '☣️',
    req: { engine: 1, tanker: 1, commander: 1 },
    perLevel: { engine: 1, tanker: 1 },
    workMin: 40,
    ambulance: true,
    police: true,
    descriptions: ['דליפת גז ממכל במפעל', 'ריח חריף של כימיקלים, עובדים מתלוננים על קשיי נשימה', 'מכלית דולפת בכביש'],
    weight: 1,
  },
  {
    key: 'rescue',
    label: 'חילוץ / הצלה',
    icon: '🧗',
    req: { engine: 1, ladder: 1 },
    perLevel: { engine: 1 },
    workMin: 20,
    ambulance: false,
    police: false,
    descriptions: ['אנשים לכודים במעלית', 'ילד נעול ברכב בשמש', 'עובד תקוע על פיגום בגובה'],
    weight: 2,
  },
];

export const INCIDENT_TYPE: Record<string, IncidentType> = Object.fromEntries(INCIDENT_TYPES.map((t) => [t.key, t]));

export const ADDRESSES: { name: string; pos: LatLng }[] = ADDRESSES_GEO;

const NAMES = ['אבי', 'יוסי', 'דני', 'מיכל', 'רונן', 'שירן', 'עומר', 'נועה', 'איתי', 'גיא', 'טל', 'ליאור', 'אלון', 'הדר', 'רועי', 'יעל', 'משה', 'עדי', 'עמית', 'אורי', 'נדב', 'שחר', 'בני', 'קרן', 'דור', 'ענבל', 'אסף', 'מאיר', 'זיו', 'רז', 'ניר', 'הילה'];
const SURNAMES = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'דהן', 'אזולאי', 'גבאי', 'חדד', 'אוחיון', 'יוסף', 'בן דוד', 'סויסה'];

export function randomName(rand: () => number): string {
  return `${NAMES[Math.floor(rand() * NAMES.length)]} ${SURNAMES[Math.floor(rand() * SURNAMES.length)]}`;
}

/** תדירות קריאות — ממוצע דקות סימולציה בין קריאות */
export const CALL_RATE_MIN: Record<CallRate, number> = { off: Infinity, low: 8, med: 4, high: 2 };
export const CALL_RATE_LABEL: Record<CallRate, string> = { off: 'כבוי', low: 'נמוכה', med: 'בינונית', high: 'גבוהה' };

/** ראשית: 41/475 פיקוד, 480 מנוף, 490 אשד, 440 צוות א, 406 צוות ב. משנה: 402 (ראשונה) / 401 (שנייה) */
export const SUB_UNITS = ['402', '401'] as const;

/** בנייה דטרמיניסטית של המצב ההתחלתי */
export function buildWorld(now: number): { stations: Station[]; vehicles: Vehicle[]; ambulances: Ambulance[] } {
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const stations: Station[] = [];
  const vehicles: Vehicle[] = [];

  const veh = (
    st: (typeof STATIONS_GEO)[number],
    unit: string,
    type: UnitType,
    homeTeam: TeamId | null,
    crewName: string,
    role?: CommanderRole,
    crewList: CrewMember[] = [{ name: crewName, role: type === 'commander' ? 'commander' : 'driver' }],
  ): Vehicle => ({
    id: `${st.id}-${unit}`,
    callsign: `${unit} ${st.short}`,
    type,
    stationId: st.id,
    homeTeam,
    crewTeam: homeTeam,
    status: 'available',
    pos: { ...st.pos },
    incidentId: null,
    statusSince: now,
    unit,
    crewName,
    ...(role ? { role } : {}),
    crew: crewList,
  });
  /** מפקד הצוות + נהג + לוחמי אש */
  const teamCrew = (t: { leader: string; crew: string[] }): CrewMember[] => [
    { name: t.leader, role: 'commander' },
    ...t.crew.map((name, i): CrewMember => ({ name, role: i === 0 ? 'driver' : 'firefighter' })),
  ];
  const crew = () => [randomName(rand), randomName(rand), randomName(rand)];

  for (const g of STATIONS_GEO) {
    if (g.parentId === null) {
      const a = { id: 'א' as const, unit: '440', leader: randomName(rand), crew: crew() };
      const b = { id: 'ב' as const, unit: '406', leader: randomName(rand), crew: crew() };
      stations.push({ id: g.id, name: g.name, pos: g.pos, parentId: null, teamOrder: ['א', 'ב'], teams: { א: a, ב: b }, turnTeam: 'א', reserve: [] });
      vehicles.push(veh(g, '41', 'commander', null, randomName(rand), 'shift'));
      vehicles.push(veh(g, '475', 'commander', null, randomName(rand), 'deputy'));
      vehicles.push(veh(g, '480', 'ladder', null, randomName(rand)));
      vehicles.push(veh(g, '490', 'tanker', null, randomName(rand)));
      vehicles.push(veh(g, '440', 'engine', 'א', a.leader, undefined, teamCrew(a)));
      vehicles.push(veh(g, '406', 'engine', 'ב', b.leader, undefined, teamCrew(b)));
    } else {
      const idx = STATIONS_GEO.filter((x) => x.parentId === g.parentId).findIndex((x) => x.id === g.id);
      const unit = SUB_UNITS[idx] ?? SUB_UNITS[SUB_UNITS.length - 1];
      const a = { id: 'א' as const, unit, leader: randomName(rand), crew: crew() };
      stations.push({ id: g.id, name: g.name, pos: g.pos, parentId: g.parentId, teamOrder: ['א'], teams: { א: a }, turnTeam: 'א', reserve: [] });
      vehicles.push(veh(g, unit, 'engine', 'א', a.leader, undefined, teamCrew(a)));
    }
  }

  // אחרי כל השמות הקבועים, כדי לא להזיז את רצף השמות של הצוותים
  for (const st of stations) st.reserve = Array.from({ length: st.parentId === null ? 6 : 3 }, () => randomName(rand));

  const ambulances: Ambulance[] = [];
  for (const base of MDA_BASES)
    for (const callsign of base.units)
      ambulances.push({
        id: `A${ambulances.length + 1}`,
        callsign,
        base: { ...base.pos },
        baseName: base.name,
        pos: { ...base.pos },
        status: 'available',
        incidentId: null,
        statusSince: now,
      });

  return { stations, vehicles, ambulances };
}
