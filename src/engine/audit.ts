/* יומן מערכת: תיאור קריא לכל פקודה, ושמירה ב-IndexedDB (שורד רענון, סגירת חלונות ואיפוס הדמיה) */
import { CALL_RATE_LABEL, INCIDENT_TYPE, UNIT_LABEL } from './config';
import type { AuditEntry, ChannelId, Command, SimState } from './model';

const VEHICLE_ACTION_LABEL = {
  depart: 'יציאה לאירוע',
  arrive: 'הגעה לזירה',
  clear: 'פנויים — חוזרים',
  home: 'בתחנה',
  offline: 'יציאה מכשירות',
  online: 'חזרה לכשירות',
} as const;

export function channelLabel(ch: ChannelId, s: SimState): string {
  if (ch === 'district') return 'מחוזי';
  if (ch === 'mda') return 'מד״א';
  if (ch === 'police') return 'משטרה';
  return s.stations.find((x) => `st${x.id}` === ch)?.name ?? ch;
}

/**
 * תיאור הפקודה לפני שהיא מבוצעת (כשהמצב עוד מכיל את מה שהיא משנה — קריאה שתנותק, רכב שישוחרר).
 * null = לא נרשם ביומן (פעימות חלון). פקודות כניסה/הפסקה נרשמות במנוע עצמו.
 */
export function describeCommand(s: SimState, cmd: Command): { text: string; incidentId?: string } | null {
  const sign = (id: string) => s.vehicles.find((v) => v.id === id)?.callsign ?? id;
  switch (cmd.type) {
    case 'openIncident': {
      const id = String(1001 + s.incidents.length);
      return { text: `פתיחת אירוע ${id}: ${INCIDENT_TYPE[cmd.typeKey]?.label ?? cmd.typeKey}, ${cmd.address}, חומרה ${cmd.severity}${cmd.callId ? ` (מקריאה ${cmd.callId})` : ''}`, incidentId: id };
    }
    case 'dropCall': {
      const c = s.calls.find((x) => x.id === cmd.callId);
      return { text: `ניתוק קריאה ${cmd.callId}${c ? ` — ${c.caller}, ${INCIDENT_TYPE[c.typeKey]?.label ?? ''}` : ''}` };
    }
    case 'dispatchRecommended':
      return { text: `שיגור לפי המלצה · אירוע ${cmd.incidentId}`, incidentId: cmd.incidentId };
    case 'dispatchUnits':
      return { text: `הזנקת כוחות לאירוע ${cmd.incidentId}: ${cmd.vehicleIds.map(sign).join(', ')}`, incidentId: cmd.incidentId };
    case 'reinforce':
      return { text: `בקשת תגבור לאירוע ${cmd.incidentId}: ${UNIT_LABEL[cmd.unitType]}`, incidentId: cmd.incidentId };
    case 'setSeverity': {
      const inc = s.incidents.find((i) => i.id === cmd.incidentId);
      return { text: `שינוי חומרה באירוע ${cmd.incidentId}: ${inc?.severity ?? '?'} → ${cmd.severity}`, incidentId: cmd.incidentId };
    }
    case 'releaseUnit': {
      const v = s.vehicles.find((x) => x.id === cmd.vehicleId);
      return { text: `שחרור ${sign(cmd.vehicleId)}${v?.incidentId ? ` מאירוע ${v.incidentId}` : ''}`, incidentId: v?.incidentId ?? undefined };
    }
    case 'closeIncident':
      return { text: `סגירת אירוע ${cmd.incidentId}`, incidentId: cmd.incidentId };
    case 'addUpdate': {
      const tag = cmd.media ? (cmd.media.kind === 'video' ? ' 🎥' : ' 📷') : '';
      return { text: `עדכון לכוחות באירוע ${cmd.incidentId}:${tag} ${cmd.text}`, incidentId: cmd.incidentId };
    }
    case 'vehicleAction': {
      const v = s.vehicles.find((x) => x.id === cmd.vehicleId);
      return { text: `${sign(cmd.vehicleId)}: ${VEHICLE_ACTION_LABEL[cmd.action]}`, incidentId: v?.incidentId ?? undefined };
    }
    case 'ackDispatch': {
      const d = s.dispatches.find((x) => x.id === cmd.dispatchId);
      const st = d && s.stations.find((x) => x.id === d.stationId);
      return { text: `אישור קבלת הזנקה${st ? ` · ${st.name}` : ''}${d ? ` · אירוע ${d.incidentId}` : ''}`, incidentId: d?.incidentId };
    }
    case 'setTurnTeam': {
      const st = s.stations.find((x) => x.id === cmd.stationId);
      return { text: `העברת תור ב${st?.name ?? `תחנה ${cmd.stationId}`} לצוות ${st?.teams[cmd.team]?.unit ?? cmd.team}` };
    }
    case 'setVehicleCrew':
      return { text: `עדכון צוות ${sign(cmd.vehicleId)}: ${cmd.crew.map((m) => m.name).join(', ') || 'ריק'}` };
    case 'sendRadio':
      return { text: `קשר · ${channelLabel(cmd.channel, s)} → ${cmd.to}: ${cmd.text}`, incidentId: cmd.incidentId };
    case 'unitRadio': {
      const v = s.vehicles.find((x) => x.id === cmd.vehicleId);
      return { text: `שידור מ${sign(cmd.vehicleId)}: ${cmd.text}`, incidentId: v?.incidentId ?? undefined };
    }
    case 'requestAmbulance':
      return { text: `בקשת אמבולנס · אירוע ${cmd.incidentId}`, incidentId: cmd.incidentId };
    case 'notifyPolice':
      return { text: `עדכון משטרה · אירוע ${cmd.incidentId}`, incidentId: cmd.incidentId };
    case 'setAutoDispatch':
      return { text: `שיגור אוטומטי: ${cmd.value ? 'פעיל' : 'כבוי'}` };
    case 'setSpeed':
      return { text: `מהירות הדמיה ×${cmd.value}` };
    case 'setPaused':
      return { text: cmd.value ? 'השהיית ההדמיה' : 'המשך ההדמיה' };
    case 'setCallRate':
      return { text: `קצב קריאות: ${CALL_RATE_LABEL[cmd.value]}` };
    case 'generateCall':
      return { text: 'יצירת קריאה ידנית' };
    case 'reset':
      return { text: 'איפוס ההדמיה' };
    case 'login':
    case 'logout':
    case 'setBreak':
    case 'heartbeat':
    case 'windowClosed':
      return null;
  }
}

/* ── שמירה ב-IndexedDB ── */

const DB_NAME = 'kaba-audit';
const STORE = 'entries';
/** כמה רשומות נשמרות לכל היותר — הישנות נמחקות */
export const AUDIT_MAX = 20_000;

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('at', 'at');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export async function loadAudit(): Promise<AuditEntry[]> {
  const d = await db();
  const all = await new Promise<AuditEntry[]>((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).index('at').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (all.length > AUDIT_MAX) {
    const store = d.transaction(STORE, 'readwrite').objectStore(STORE);
    for (const e of all.slice(0, all.length - AUDIT_MAX)) store.delete(e.id);
  }
  return all.slice(-AUDIT_MAX);
}

export function saveAudit(e: AuditEntry) {
  db()
    .then((d) => d.transaction(STORE, 'readwrite').objectStore(STORE).put(e))
    .catch(() => {
      /* אחסון חסום (גלישה פרטית) — היומן נשאר בזיכרון בלבד */
    });
}

/**
 * מחבר את יומן המנוע לאחסון ולחלונות: טוען את היומן השמור, שומר כל רשומה חדשה,
 * ומעביר ל-push כל תוספת. מחזיר את כל היומן הנוכחי — לחלון שהתחבר עכשיו.
 */
export function hostAudit(onAudit: (fn: (e: AuditEntry) => void) => void, push: (entries: AuditEntry[]) => void): () => AuditEntry[] {
  let entries: AuditEntry[] = [];
  const trim = () => {
    if (entries.length > AUDIT_MAX) entries = entries.slice(-AUDIT_MAX);
  };
  onAudit((e) => {
    entries.push(e);
    trim();
    saveAudit(e);
    push([e]);
  });
  if (typeof indexedDB !== 'undefined')
    loadAudit()
      .then((old) => {
        const seen = new Set(entries.map((e) => e.id));
        const fresh = old.filter((e) => !seen.has(e.id));
        entries = [...fresh, ...entries].sort((a, b) => a.at - b.at);
        trim();
        if (fresh.length) push(fresh);
      })
      .catch(() => {});
  return () => entries;
}
