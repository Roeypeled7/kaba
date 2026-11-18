import { ADDRESSES, CALL_RATE_MIN, INCIDENT_TYPES, randomName } from './config';
import { distKm } from './dispatch';
import type { CallRate, IncomingCall, LatLng, SiteAccess } from './model';

/** מזיז נקודה לעבר יעד. מחזיר true כשהגיע. */
export function moveToward(pos: LatLng, target: LatLng, kmh: number, dtSec: number): boolean {
  const d = distKm(pos, target);
  const step = (kmh * dtSec) / 3600;
  if (d <= step || d < 0.01) {
    pos.lat = target.lat;
    pos.lng = target.lng;
    return true;
  }
  const f = step / d;
  pos.lat += (target.lat - pos.lat) * f;
  pos.lng += (target.lng - pos.lng) * f;
  return false;
}

export function etaMin(from: LatLng, to: LatLng, kmh: number): number {
  return Math.max(1, Math.round((distKm(from, to) / kmh) * 60));
}

export function nextCallDelayMs(rate: CallRate): number {
  const mean = CALL_RATE_MIN[rate];
  if (!isFinite(mean)) return Infinity;
  // התפלגות מעריכית עם רצפה, כדי שלא יגיעו שתי קריאות באותה שנייה
  return Math.max(30, -Math.log(1 - Math.random()) * mean * 60) * 1000;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const i of items) if ((r -= i.weight) < 0) return i;
  return items[items.length - 1];
}

/** אירוע בתוך בניין — המודיע מוסר קומה, דירה וקוד כניסה (לא תמיד את כולם) */
function randomSite(typeKey: string): SiteAccess | undefined {
  if (typeKey !== 'structure' && !(typeKey === 'rescue' && Math.random() < 0.6)) return undefined;
  const floor = 1 + Math.floor(Math.random() * 9);
  const n = () => Math.floor(Math.random() * 10);
  return {
    floor: String(floor),
    apartment: String((floor - 1) * 4 + 1 + Math.floor(Math.random() * 4)),
    entryCode: Math.random() < 0.8 ? `${n()}${n()}${n()}${n()}#` : undefined,
  };
}

export function makeCall(id: string, t: number): IncomingCall {
  const type = pickWeighted(INCIDENT_TYPES);
  const phone = `05${Math.floor(Math.random() * 10)}-${String(Math.floor(1000000 + Math.random() * 8999999))}`;
  return {
    id,
    t,
    caller: randomName(Math.random),
    phone,
    typeKey: type.key,
    addressIdx: Math.floor(Math.random() * ADDRESSES.length),
    description: type.descriptions[Math.floor(Math.random() * type.descriptions.length)],
    site: randomSite(type.key),
  };
}
