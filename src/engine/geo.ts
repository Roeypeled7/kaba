/**
 * נתוני גאוגרפיה של המחוז — מקור אמת יחיד למיקומים.
 * ⚠ נכתב ע״י סוכן המחקר. מבנה הקובץ הוא חוזה: אסור לשנות שמות/טיפוסים.
 */
import type { LatLng } from './model';

export interface StationGeo {
  id: number;
  name: string; // 'תחנת רחובות', 'תחנת יבנה'…
  short: string; // 'רחובות', 'יבנה' — משמש באות הקריאה: '440 רחובות'
  parentId: number | null;
  pos: LatLng;
}

/** ראשיות 1–6, משנה = parent*10 + n. סדר תחנות המשנה קובע: הראשונה 402, השנייה 401 */
export const STATIONS_GEO: StationGeo[] = [
  { id: 1, name: 'תחנת רחובות', short: 'רחובות', parentId: null, pos: { lat: 31.8975, lng: 34.8085 } },
  { id: 11, name: 'תחנת יבנה', short: 'יבנה', parentId: 1, pos: { lat: 31.877, lng: 34.7395 } },
  { id: 12, name: 'תחנת גדרה', short: 'גדרה', parentId: 1, pos: { lat: 31.8135, lng: 34.779 } },
  { id: 2, name: 'תחנת ראשון לציון', short: 'ראשון לציון', parentId: null, pos: { lat: 31.969, lng: 34.7945 } },
  { id: 21, name: 'תחנת אזור התעשייה ראשון לציון', short: 'אזה״ת ראשל״צ', parentId: 2, pos: { lat: 31.9885, lng: 34.7705 } },
  { id: 3, name: 'תחנת איילון (רמלה)', short: 'איילון', parentId: null, pos: { lat: 31.9285, lng: 34.866 } },
  { id: 31, name: 'תחנת מודיעין', short: 'מודיעין', parentId: 3, pos: { lat: 31.899, lng: 35.009 } },
  { id: 32, name: 'תחנת באר יעקב', short: 'באר יעקב', parentId: 3, pos: { lat: 31.942, lng: 34.835 } },
  { id: 4, name: 'תחנת פתח תקווה', short: 'פתח תקווה', parentId: null, pos: { lat: 32.0925, lng: 34.8805 } },
  { id: 41, name: 'תחנת ראש העין', short: 'ראש העין', parentId: 4, pos: { lat: 32.0955, lng: 34.956 } },
  { id: 42, name: 'תחנת אלעד', short: 'אלעד', parentId: 4, pos: { lat: 32.052, lng: 34.9515 } },
  { id: 5, name: 'תחנת כפר סבא', short: 'כפר סבא', parentId: null, pos: { lat: 32.1745, lng: 34.8975 } },
  { id: 51, name: 'תחנת מצפה ספיר', short: 'מצפה ספיר', parentId: 5, pos: { lat: 32.19, lng: 34.935 } },
  { id: 52, name: 'תחנת צור יגאל', short: 'צור יגאל', parentId: 5, pos: { lat: 32.2215, lng: 34.979 } },
  { id: 6, name: 'תחנת נתניה', short: 'נתניה', parentId: null, pos: { lat: 32.311, lng: 34.864 } },
  { id: 61, name: 'תחנת יכון', short: 'יכון', parentId: 6, pos: { lat: 32.3, lng: 34.9 } },
  { id: 62, name: 'תחנת קדימה צורן', short: 'קדימה צורן', parentId: 6, pos: { lat: 32.277, lng: 34.914 } },
];

export const DISTRICT_GEO = {
  name: 'מחוז מרכז',
  center: { lat: 32.05, lng: 34.87 } as LatLng,
  zoom: 11,
};

export const HOSPITALS: { name: string; pos: LatLng }[] = [
  { name: 'מרכז רפואי קפלן', pos: { lat: 31.8722, lng: 34.8135 } },
  { name: 'מרכז רפואי שמיר (אסף הרופא)', pos: { lat: 31.9562, lng: 34.8436 } },
  { name: 'בילינסון', pos: { lat: 32.0897, lng: 34.8665 } },
  { name: 'מרכז רפואי מאיר', pos: { lat: 32.1797, lng: 34.8935 } },
  { name: 'מרכז רפואי לניאדו', pos: { lat: 32.3410, lng: 34.8590 } },
];

export const MDA_BASES: { name: string; pos: LatLng; units: string[] }[] = [
  { name: 'מד״א רחובות', pos: { lat: 31.8970, lng: 34.8080 }, units: ['אמבולנס 2011', 'נט״ן 2071'] },
  { name: 'מד״א ראשון לציון', pos: { lat: 31.9650, lng: 34.8000 }, units: ['אמבולנס 2210'] },
  { name: 'מד״א רמלה', pos: { lat: 31.9270, lng: 34.8700 }, units: ['אמבולנס 2420'] },
  { name: 'מד״א מודיעין', pos: { lat: 31.9000, lng: 35.0080 }, units: ['אמבולנס 2510'] },
  { name: 'מד״א פתח תקווה', pos: { lat: 32.0900, lng: 34.8850 }, units: ['אמבולנס 1810', 'נט״ן 1871'] },
  { name: 'מד״א כפר סבא', pos: { lat: 32.1795, lng: 34.9010 }, units: ['אמבולנס 1411'] },
  { name: 'מד״א נתניה', pos: { lat: 32.3250, lng: 34.8580 }, units: ['אמבולנס 1610', 'נט״ן 1671'] },
];

/** ~4 כתובות לכל עיר ראשית, ~1–2 לכל תחנת משנה, כולל צירים ראשיים ושטחים פתוחים */
export const ADDRESSES_GEO: { name: string; pos: LatLng }[] = [
  { name: 'רחובות, הרצל 150', pos: { lat: 31.893, lng: 34.811 } },
  { name: 'רחובות, פארק המדע', pos: { lat: 31.907, lng: 34.802 } },
  { name: 'רחובות, אזור התעשייה הצפוני', pos: { lat: 31.91, lng: 34.813 } },
  { name: 'כביש 40, צומת בילו', pos: { lat: 31.86, lng: 34.825 } },
  { name: 'יבנה, שדרות דואני', pos: { lat: 31.878, lng: 34.742 } },
  { name: 'גדרה, דרך הפרחים', pos: { lat: 31.812, lng: 34.778 } },
  { name: 'ראשון לציון, הרצל 40', pos: { lat: 31.964, lng: 34.804 } },
  { name: 'ראשון לציון, קניון הזהב', pos: { lat: 31.99, lng: 34.774 } },
  { name: 'ראשון לציון, אזור התעשייה המערבי', pos: { lat: 31.987, lng: 34.766 } },
  { name: 'כביש 20, מחלף ראשון מערב', pos: { lat: 31.98, lng: 34.755 } },
  { name: 'רמלה, הרצל 90', pos: { lat: 31.929, lng: 34.871 } },
  { name: 'לוד, מרכז העיר', pos: { lat: 31.952, lng: 34.895 } },
  { name: 'כביש 1, מחלף ענבה', pos: { lat: 31.889, lng: 34.983 } },
  { name: 'מודיעין, עזריאלי מודיעין', pos: { lat: 31.901, lng: 35.005 } },
  { name: 'באר יעקב, הרצל 30', pos: { lat: 31.943, lng: 34.836 } },
  { name: 'פתח תקווה, ז׳בוטינסקי 100', pos: { lat: 32.091, lng: 34.872 } },
  { name: 'פתח תקווה, קריית אריה', pos: { lat: 32.103, lng: 34.859 } },
  { name: 'פתח תקווה, סגולה', pos: { lat: 32.104, lng: 34.901 } },
  { name: 'כביש 4, מחלף גהה', pos: { lat: 32.084, lng: 34.856 } },
  { name: 'ראש העין, אזור התעשייה אפק', pos: { lat: 32.103, lng: 34.933 } },
  { name: 'אלעד, רבי יהודה הנשיא', pos: { lat: 32.053, lng: 34.953 } },
  { name: 'שטח פתוח, פארק הירקון מזרח', pos: { lat: 32.104, lng: 34.93 } },
  { name: 'כפר סבא, ויצמן 120', pos: { lat: 32.1772, lng: 34.9058 } },
  { name: 'כפר סבא, קניון ערים', pos: { lat: 32.1781, lng: 34.9121 } },
  { name: 'רעננה, אחוזה 100', pos: { lat: 32.1842, lng: 34.8717 } },
  { name: 'כביש 55, צומת כפר סבא מזרח', pos: { lat: 32.172, lng: 34.931 } },
  { name: 'צור יגאל, שדות מזרחיים', pos: { lat: 32.224, lng: 34.985 } },
  { name: 'נתניה, הרצל 20', pos: { lat: 32.329, lng: 34.856 } },
  { name: 'נתניה, אזור התעשייה ספיר', pos: { lat: 32.281, lng: 34.865 } },
  { name: 'נתניה, חוף הים', pos: { lat: 32.333, lng: 34.85 } },
  { name: 'כביש 2, מחלף פולג', pos: { lat: 32.278, lng: 34.85 } },
  { name: 'קדימה צורן, שדרות שבזי', pos: { lat: 32.278, lng: 34.915 } },
  { name: 'שטח פתוח, יער קדימה', pos: { lat: 32.285, lng: 34.93 } },
];
