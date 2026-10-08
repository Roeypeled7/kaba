import type { LatLng, Station, UnitType, Vehicle, Ambulance, VehicleStatus, AmbulanceStatus, IncidentStatus, CallRate } from './model';

/** כל המיקומים משוערים — לשינוי חופשי. */
export const DISTRICT = {
  name: 'מחוז מרכז — גזרת השרון',
  center: { lat: 32.176, lng: 34.885 } as LatLng,
  zoom: 13,
  hospital: { name: 'בי״ח מאיר', pos: { lat: 32.1797, lng: 34.8935 } as LatLng },
};

export const DEFAULT_SPEED = 5;

export const UNIT_LABEL: Record<UnitType, string> = {
  engine: 'רביעייה',
  tanker: 'מיכלית',
  rescue: 'רכב חילוץ',
  commander: 'מפקד',
};

/** מהירות ממוצעת בקמ״ש */
export const UNIT_SPEED_KMH: Record<UnitType, number> = {
  engine: 55,
  tanker: 45,
  rescue: 55,
  commander: 75,
};
export const AMBULANCE_SPEED_KMH = 65;

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
    req: { engine: 2, tanker: 1, commander: 1 },
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
    perLevel: { tanker: 1, engine: 1 },
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
    req: { rescue: 1, engine: 1 },
    perLevel: { rescue: 1, commander: 1 },
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
    req: { engine: 1, commander: 1 },
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
    req: { rescue: 1, engine: 1 },
    perLevel: { rescue: 1 },
    workMin: 20,
    ambulance: false,
    police: false,
    descriptions: ['אנשים לכודים במעלית', 'ילד נעול ברכב בשמש', 'עובד תקוע על פיגום בגובה'],
    weight: 2,
  },
];

export const INCIDENT_TYPE: Record<string, IncidentType> = Object.fromEntries(INCIDENT_TYPES.map((t) => [t.key, t]));

export const ADDRESSES: { name: string; pos: LatLng }[] = [
  { name: 'כפר סבא, ויצמן 120', pos: { lat: 32.1772, lng: 34.9058 } },
  { name: 'כפר סבא, תל חי 50', pos: { lat: 32.1712, lng: 34.9035 } },
  { name: 'כפר סבא, קניון ערים', pos: { lat: 32.1781, lng: 34.9121 } },
  { name: 'כפר סבא, אזור התעשייה — התעשייה 12', pos: { lat: 32.1655, lng: 34.9175 } },
  { name: 'כפר סבא, פארק העיר', pos: { lat: 32.1868, lng: 34.9072 } },
  { name: 'כפר סבא, שטח פתוח צפון-מזרח', pos: { lat: 32.1985, lng: 34.9210 } },
  { name: 'כביש 55, צומת כפר סבא מזרח', pos: { lat: 32.1720, lng: 34.9310 } },
  { name: 'רעננה, אחוזה 100', pos: { lat: 32.1842, lng: 34.8717 } },
  { name: 'רעננה, אחוזה 200 — מרכז מסחרי', pos: { lat: 32.1846, lng: 34.8790 } },
  { name: 'רעננה, פארק רעננה', pos: { lat: 32.1920, lng: 34.8838 } },
  { name: 'רעננה, אזור התעשייה — התדהר 5', pos: { lat: 32.1995, lng: 34.8635 } },
  { name: 'כביש 4, מחלף רעננה צפון', pos: { lat: 32.2010, lng: 34.8560 } },
  { name: 'הוד השרון, דרך רמתיים 50', pos: { lat: 32.1535, lng: 34.8905 } },
  { name: 'הוד השרון, שדות מגדיאל', pos: { lat: 32.1440, lng: 34.9060 } },
  { name: 'הרצליה, סוקולוב 40', pos: { lat: 32.1640, lng: 34.8430 } },
  { name: 'הרצליה פיתוח, אזור התעשייה', pos: { lat: 32.1612, lng: 34.8075 } },
  { name: 'כביש 531, צומת רעננה דרום', pos: { lat: 32.1720, lng: 34.8650 } },
  { name: 'נווה ירק, שדות חקלאיים', pos: { lat: 32.1700, lng: 34.8800 } },
];

const NAMES = ['אבי', 'יוסי', 'דני', 'מיכל', 'רונן', 'שירן', 'עומר', 'נועה', 'איתי', 'גיא', 'טל', 'ליאור', 'אלון', 'הדר', 'רועי', 'יעל', 'משה', 'עדי', 'עמית', 'אורי', 'נדב', 'שחר', 'בני', 'קרן', 'דור', 'ענבל', 'אסף', 'מאיר', 'זיו', 'רז', 'ניר', 'הילה'];
const SURNAMES = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'דהן', 'אזולאי', 'גבאי', 'חדד', 'אוחיון', 'יוסף', 'בן דוד', 'סויסה'];

export function randomName(rand: () => number): string {
  return `${NAMES[Math.floor(rand() * NAMES.length)]} ${SURNAMES[Math.floor(rand() * SURNAMES.length)]}`;
}

/** תדירות קריאות — ממוצע דקות סימולציה בין קריאות */
export const CALL_RATE_MIN: Record<CallRate, number> = { off: Infinity, low: 8, med: 4, high: 2 };
export const CALL_RATE_LABEL: Record<CallRate, string> = { off: 'כבוי', low: 'נמוכה', med: 'בינונית', high: 'גבוהה' };

interface StationSeed {
  id: number;
  name: string;
  pos: LatLng;
  onScreen: boolean;
  rescue: boolean;
  commander: string;
}

const STATION_SEEDS: StationSeed[] = [
  { id: 1, name: 'תחנת כפר סבא', pos: { lat: 32.1745, lng: 34.8975 }, onScreen: true, rescue: true, commander: 'רפ״ק אבי שושן' },
  { id: 2, name: 'תחנת רעננה', pos: { lat: 32.1905, lng: 34.8745 }, onScreen: true, rescue: true, commander: 'רפ״ק מיכל אדרי' },
  { id: 3, name: 'תחנת הוד השרון', pos: { lat: 32.1505, lng: 34.8870 }, onScreen: false, rescue: false, commander: 'רפ״ק גיא בר' },
  { id: 4, name: 'תחנת הרצליה', pos: { lat: 32.1660, lng: 34.8440 }, onScreen: false, rescue: true, commander: 'רפ״ק טל נחום' },
];

/** בנייה דטרמיניסטית של המצב ההתחלתי */
export function buildWorld(now: number): { stations: Station[]; vehicles: Vehicle[]; ambulances: Ambulance[] } {
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const stations: Station[] = [];
  const vehicles: Vehicle[] = [];

  const veh = (v: Omit<Vehicle, 'crewTeam' | 'status' | 'incidentId' | 'statusSince'>): Vehicle => ({
    ...v,
    crewTeam: v.homeTeam,
    status: 'available',
    incidentId: null,
    statusSince: now,
  });

  for (const seed of STATION_SEEDS) {
    const crew = () => [randomName(rand), randomName(rand), randomName(rand)];
    stations.push({
      id: seed.id,
      name: seed.name,
      pos: seed.pos,
      onScreen: seed.onScreen,
      teams: {
        א: { id: 'א', leader: randomName(rand), crew: crew() },
        ב: { id: 'ב', leader: randomName(rand), crew: crew() },
      },
      turnTeam: 'א',
    });
    const n = seed.id;
    const p = seed.pos;
    vehicles.push(veh({ id: `E${n}1`, callsign: `כבאי ${n}1`, type: 'engine', stationId: n, homeTeam: 'א', pos: { ...p } }));
    vehicles.push(veh({ id: `E${n}2`, callsign: `כבאי ${n}2`, type: 'engine', stationId: n, homeTeam: 'ב', pos: { ...p } }));
    vehicles.push(veh({ id: `T${n}5`, callsign: `מיכלית ${n}5`, type: 'tanker', stationId: n, homeTeam: null, pos: { ...p } }));
    if (seed.rescue) vehicles.push(veh({ id: `R${n}7`, callsign: `חילוץ ${n}7`, type: 'rescue', stationId: n, homeTeam: null, pos: { ...p } }));
    vehicles.push(veh({ id: `C${n}0`, callsign: `מפקד ${n}0`, type: 'commander', stationId: n, homeTeam: null, pos: { ...p }, commanderName: seed.commander }));
  }
  // קצין מבצעים מחוזי — יושב בתחנת כפר סבא
  vehicles.push(
    veh({ id: 'C01', callsign: 'קמ״ב 1', type: 'commander', stationId: 1, homeTeam: null, pos: { ...STATION_SEEDS[0].pos }, commanderName: 'סגן טפסר יואב רגב (קמ״ב)' }),
  );

  const amb = (id: string, callsign: string, baseName: string, base: LatLng): Ambulance => ({
    id,
    callsign,
    base,
    baseName,
    pos: { ...base },
    status: 'available',
    incidentId: null,
    statusSince: now,
  });
  const ambulances: Ambulance[] = [
    amb('A1', 'אמבולנס 1411', 'מד״א כפר סבא', { lat: 32.1795, lng: 34.9010 }),
    amb('A2', 'נט״ן 1471', 'מד״א כפר סבא', { lat: 32.1795, lng: 34.9010 }),
    amb('A3', 'אמבולנס 1520', 'מד״א רעננה', { lat: 32.1838, lng: 34.8655 }),
    amb('A4', 'אמבולנס 1630', 'מד״א הוד השרון', { lat: 32.1555, lng: 34.8960 }),
  ];

  return { stations, vehicles, ambulances };
}
