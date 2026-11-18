/* שמירת מצב ההדמיה ב-IndexedDB — כדי שרענון או סגירה של כל החלונות לא ימחקו את האירועים הפעילים */
import type { SimState } from './model';

/** להעלות כשמבנה SimState משתנה באופן שמצב ישן כבר לא מתאים לו */
const SCHEMA = 1;
/** מצב ישן מזה לא משוחזר — ההדמיה מתחילה מחדש */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DB_NAME = 'kaba-sim';
const STORE = 'kv';
const KEY = 'state';

interface Saved {
  schema: number;
  at: number;
  state: SimState;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadState(): Promise<SimState | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await open();
    const saved = await new Promise<Saved | undefined>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as Saved | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!saved || saved.schema !== SCHEMA || Date.now() - saved.at > MAX_AGE_MS) return null;
    const s = saved.state;
    return Array.isArray(s?.vehicles) && Array.isArray(s?.incidents) && Array.isArray(s?.stations) ? s : null;
  } catch {
    return null; // אחסון חסום / פגום — מתחילים מחדש
  }
}

export async function saveState(state: SimState): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ schema: SCHEMA, at: Date.now(), state } satisfies Saved, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* לא נשמר — ממשיכים בזיכרון */
  }
}
