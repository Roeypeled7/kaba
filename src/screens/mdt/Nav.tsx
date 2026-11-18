import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import { INCIDENT_TYPE, STATUS_LABEL, UNIT_SPEED_KMH } from '../../engine/config';
import { distKm } from '../../engine/dispatch';
import { etaMin } from '../../engine/simulation';
import type { Incident, LatLng } from '../../engine/model';
import { vehicleIcon } from '../../components/mapkit';
import { fmtHM } from '../../components/ui';
import type { Ctx } from './shared';
import './nav.css';

/**
 * ניווט בתוך הטאבלט, במראה של Waze: מסלול אמיתי על הכבישים, הוראת הפנייה הבאה, מרחק וזמן הגעה.
 * שירות המסלולים מבודד ב-fetchRoute — כדי להחליף ספק (Google Maps / Waze) משנים רק את הפונקציה הזו.
 */

interface Step {
  /** אורך המקטע שמתחיל בתמרון הזה, בק״מ */
  km: number;
  name: string;
  type: string;
  modifier?: string;
  exit?: number;
  /** מיקום התמרון — לתווית שם הרחוב על המסלול */
  at?: LatLng;
}
interface Route {
  pts: LatLng[];
  /** מרחק מצטבר לכל נקודה, בק״מ */
  cum: number[];
  total: number;
  steps: Step[];
}

const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';
const cache = new Map<string, Promise<Route | null>>();

function build(pts: LatLng[], steps: Step[]): Route {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distKm(pts[i - 1], pts[i]));
  return { pts, cum, total: cum[cum.length - 1], steps };
}

/** מסלול נסיעה בין שתי נקודות. נכשל (אין רשת / אין מסלול) → null, והמסך נופל לקו ישר */
function fetchRoute(from: LatLng, to: LatLng): Promise<Route | null> {
  const key = `${from.lat},${from.lng};${to.lat},${to.lng}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`${ROUTE_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const r = j?.routes?.[0];
        if (!r) return null;
        const pts: LatLng[] = r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
        const steps: Step[] = r.legs[0].steps.map((s: { distance: number; name: string; maneuver: { type: string; modifier?: string; exit?: number; location: [number, number] } }) => ({
          km: s.distance / 1000,
          name: s.name,
          type: s.maneuver.type,
          modifier: s.maneuver.modifier,
          exit: s.maneuver.exit,
          at: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] },
        }));
        return pts.length > 1 ? build(pts, steps) : null;
      })
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

/** הנקודה על המסלול אחרי km ק״מ, וכיוון הנסיעה בה (מעלות, 0 = צפון) */
function along(r: Route, km: number): { pos: LatLng; bearing: number } {
  const d = Math.max(0, Math.min(r.total, km));
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < d) i++;
  const a = r.pts[i - 1];
  const b = r.pts[i];
  const seg = r.cum[i] - r.cum[i - 1] || 1;
  const f = (d - r.cum[i - 1]) / seg;
  const bearing = (Math.atan2((b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180), b.lat - a.lat) * 180) / Math.PI;
  return { pos: { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }, bearing };
}

const DIR: Record<string, string> = {
  left: 'שמאלה',
  right: 'ימינה',
  'slight left': 'קלות שמאלה',
  'slight right': 'קלות ימינה',
  'sharp left': 'חדה שמאלה',
  'sharp right': 'חדה ימינה',
};

/** הוראת התמרון וסמל החץ שלה */
function instruction(s: Step): { text: string; arrow: string } {
  const side = s.modifier?.includes('left') ? 'left' : s.modifier?.includes('right') ? 'right' : null;
  const arrow = side === 'left' ? '↰' : side === 'right' ? '↱' : '↑';
  if (s.type === 'arrive') return { text: 'הגעתם ליעד', arrow: '📍' };
  if (s.type === 'roundabout' || s.type === 'rotary') return { text: `בכיכר — יציאה ${s.exit ?? 1}`, arrow: '⟳' };
  if (s.modifier === 'uturn') return { text: 'פניית פרסה', arrow: '↶' };
  if (s.type === 'off ramp') return { text: `רדו במחלף${side ? ` ${DIR[side]}` : ''}`, arrow };
  if (s.type === 'on ramp' || s.type === 'merge') return { text: 'השתלבו בכביש', arrow };
  if (!side || !s.modifier) return { text: 'המשיכו ישר', arrow: '↑' };
  return { text: `פנו ${DIR[s.modifier] ?? DIR[side]}`, arrow };
}

const fmtDist = (km: number) => (km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} מ׳` : `${km.toFixed(1)} ק״מ`);

/** החץ של הרכב. הסיבוב שלו נקבע בכל פריים ב-Driver, כך שהוא תמיד מצביע למעלה על המסך */
const ME_ICON = L.divIcon({ className: '', html: '<div class="mdt-nav-me"><i></i></div>', iconSize: [84, 84], iconAnchor: [42, 42] });

/** מפת בסיס כהה ונקייה (Esri Dark Gray): רקע כהה, כבישים בהירים ושמות רחובות — הגוון הכחלחל של Waze נעשה ב-CSS (nav.css) */
const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const FOLLOW_ZOOM = 17;

/** היעד: סיכה אדומה שעומדת זקופה גם כשהמפה מסתובבת (‎--unspin מבטל את סיבוב המפה) */
const DEST_ICON = L.divIcon({ className: '', html: '<div class="mdt-nav-dest-pin"><i></i></div>', iconSize: [0, 0], iconAnchor: [0, 0] });

/** כיוון הדרך שלפני נקודה על המסלול: אל נקודה 40 מ׳ קדימה (יציב יותר ממקטע בודד); בסוף המסלול — כיוון המקטע האחרון */
function headingAt(r: Route, km: number): number {
  const here = along(r, km);
  if (r.total - km <= 0.005) return here.bearing;
  const fwd = along(r, km + 0.04).pos;
  return (Math.atan2((fwd.lng - here.pos.lng) * Math.cos((here.pos.lat * Math.PI) / 180), fwd.lat - here.pos.lat) * 180) / Math.PI;
}

/**
 * מניע את התצוגה בכל פריים, כדי שהתנועה תהיה חלקה: ההדמיה מעדכנת את מיקום הרכב רק כמה פעמים בשנייה,
 * וכאן ממלאים את הרווח — הרכב גולש ממדידה למדידה בקצב קבוע, והמפה, קו המסלול, החץ והסיבוב זזים יחד איתו.
 * המפה תמיד ממורכזת על הרכב ומסובבת כך שהדרך שלפניו פונה למעלה.
 */
function Driver({ route, done, me, lines, spin }: { route: Route; done: number; me: React.RefObject<L.Marker>; lines: React.RefObject<L.Polyline>[]; spin: React.RefObject<HTMLDivElement> }) {
  const map = useMap();
  const anim = useRef({ from: done, to: done, start: 0, dur: 400, last: 0, shown: done, angle: null as number | null, key: '' });

  // מדידה חדשה מההדמיה: גולשים אליה מהמקום שמוצג עכשיו, במשך הזמן שעבר מאז המדידה הקודמת
  useEffect(() => {
    const a = anim.current;
    const now = performance.now();
    if (!a.last || Math.abs(done - a.shown) > 0.5) a.from = a.to = a.shown = done; // התחלה, או קפיצה (הגעה / מסלול חדש) — בלי גלישה
    else {
      a.from = a.shown;
      a.to = done;
      a.start = now;
      a.dur = Math.max(250, Math.min(1500, now - a.last));
    }
    a.last = now;
  }, [done, route]);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    anim.current.key = ''; // מסלול חדש — לצייר מחדש גם אם הרכב לא זז
    const frame = (now: number) => {
      const a = anim.current;
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      a.shown = a.from + (a.to - a.from) * Math.min(1, (now - a.start) / a.dur);
      const { pos } = along(route, a.shown);
      // הסיבוב מתקרב לכיוון הדרך בהדרגה, ובדרך הקצרה (359°→1° לא מסובב סיבוב שלם)
      const want = -headingAt(route, a.shown);
      if (a.angle === null) a.angle = want;
      else a.angle += (((((want - a.angle) % 360) + 540) % 360) - 180) * (1 - Math.exp(-dt / 0.35));

      const key = `${pos.lat.toFixed(6)},${pos.lng.toFixed(6)},${a.angle.toFixed(2)}`;
      if (key !== a.key) {
        a.key = key;
        map.setView([pos.lat, pos.lng], FOLLOW_ZOOM, { animate: false });
        me.current?.setLatLng([pos.lat, pos.lng]);
        const arrow = me.current?.getElement()?.firstElementChild as HTMLElement | null | undefined;
        if (arrow) arrow.style.transform = `rotate(${-a.angle}deg)`;
        if (spin.current) {
          spin.current.style.transform = `rotate(${a.angle}deg)`;
          spin.current.style.setProperty('--unspin', `${-a.angle}deg`);
        }
        // קו המסלול מתחיל תמיד בדיוק מהרכב
        const cut = route.cum.findIndex((c) => c > a.shown);
        const ahead: [number, number][] = [[pos.lat, pos.lng], ...route.pts.slice(cut < 0 ? route.pts.length : cut).map((p) => [p.lat, p.lng] as [number, number])];
        for (const l of lines) l.current?.setLatLngs(ahead);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [route, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function Nav({ ctx, inc }: { ctx: Ctx; inc: Incident }) {
  const { state, v, st } = ctx;
  const t = INCIDENT_TYPE[inc.typeKey];
  const driving = v.status === 'enroute';
  const waiting = v.status === 'dispatched';
  const arrived = v.status === 'onscene' || v.status === 'cleared';

  // המסלול מחושב מהתחנה (נקודת היציאה) אל האירוע; עד שהוא מגיע — קו ישר
  const [road, setRoad] = useState<Route | null>(null);
  useEffect(() => {
    let live = true;
    setRoad(null);
    fetchRoute(st.pos, inc.pos).then((r) => live && setRoad(r));
    return () => {
      live = false;
    };
  }, [st.pos.lat, st.pos.lng, inc.pos.lat, inc.pos.lng]);
  const route = useMemo(() => road ?? build([st.pos, inc.pos], [{ km: distKm(st.pos, inc.pos), name: '', type: 'depart' }, { km: 0, name: '', type: 'arrive' }]), [road, st.pos, inc.pos]);

  // ההדמיה מזיזה את הרכב בקו אווירי; את ההתקדמות שלו משליכים על המסלול שבכבישים
  const air = distKm(st.pos, inc.pos) || 1;
  const progress = arrived ? 1 : waiting ? 0 : Math.max(0, Math.min(1, 1 - distKm(v.pos, inc.pos) / air));
  const done = route.total * progress;
  const left = route.total - done;
  const eta = etaMin(v.pos, inc.pos, UNIT_SPEED_KMH[v.type]);

  // התמרון הבא: סוף המקטע שבו הרכב נמצא עכשיו
  let acc = 0;
  let idx = 0;
  while (idx < route.steps.length - 1 && acc + route.steps[idx].km <= done) acc += route.steps[idx++].km;
  const next = route.steps[Math.min(idx + 1, route.steps.length - 1)];
  const toNext = Math.max(0, acc + route.steps[idx].km - done);
  const ins = instruction(next);

  // מיקום התחלתי בלבד לרכב ולקו — מכאן Driver מזיז אותם בכל פריים
  const line = useMemo(() => route.pts.map((p) => [p.lat, p.lng] as [number, number]), [route]);
  const start = useMemo<[number, number]>(() => [route.pts[0].lat, route.pts[0].lng], [route]);
  const meRef = useRef<L.Marker>(null);
  const lineA = useRef<L.Polyline>(null);
  const lineB = useRef<L.Polyline>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const others = state.vehicles.filter((x) => x.incidentId === inc.id && x.id !== v.id);

  const speed = driving && left > 0.02 ? UNIT_SPEED_KMH[v.type] : 0;
  const nextName = next.type === 'arrive' ? inc.address : next.name;

  return (
    <section className="mdt-nav waze">
      {/* המפה מוטה מעט לאחור — גדולה מהמסגרת כדי למלא אותה גם בסיבוב */}
      <div className="mdt-nav-tilt">
       <div className="mdt-nav-spin" ref={spinRef}>
        <MapContainer
          center={[inc.pos.lat, inc.pos.lng]}
          zoom={14}
          zoomControl={false}
          attributionControl={false}
          // המפה לתצוגה בלבד: בלי גרירה, זום או פוקוס מקלדת. פוקוס על המפה גרם לדפדפן לגלול את המסגרת, והתצוגה נחתכה
          keyboard={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          boxZoom={false}
        >
          <TileLayer url={TILES} maxZoom={19} maxNativeZoom={16} />
          <Driver route={route} done={done} me={meRef} lines={[lineA, lineB]} spin={spinRef} />
          {!arrived && (
            <>
              <Polyline ref={lineA} positions={line} pathOptions={{ color: '#0e86b8', weight: 34, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
              <Polyline ref={lineB} positions={line} pathOptions={{ color: '#2fd6ff', weight: 24, lineCap: 'round', lineJoin: 'round' }} />
            </>
          )}
          <Marker position={[inc.pos.lat, inc.pos.lng]} icon={DEST_ICON} interactive={false} />
          {others.map((x) => (
            <Marker key={x.id} position={[x.pos.lat, x.pos.lng]} icon={vehicleIcon(x)} />
          ))}
          <Marker ref={meRef} position={start} icon={ME_ICON} zIndexOffset={500} interactive={false} />
        </MapContainer>
       </div>
      </div>

      <div className="mdt-nav-top">
        <span className="mdt-nav-arrow">{driving ? ins.arrow : arrived ? '📍' : '↑'}</span>
        {driving ? (
          <div>
            <div className="mdt-nav-dist">{fmtDist(toNext)}</div>
            <div className="mdt-nav-sub">
              {ins.text}
              {nextName && ` · ${nextName}`}
            </div>
          </div>
        ) : (
          <div>
            <div className="mdt-nav-dest">{inc.address}</div>
            <div className="mdt-nav-sub">
              {t.icon} {t.label} · {arrived ? 'הגעתם ליעד' : waiting ? 'ממתין ליציאה' : STATUS_LABEL[v.status]}
            </div>
          </div>
        )}
      </div>

      {!arrived && (
        <>
          <div className="mdt-nav-speed">
            <b className="mono">{speed}</b>
            <span>קמ״ש</span>
          </div>
          <div className="mdt-nav-trip">
            <b className="mono">{fmtHM(state.simTime + eta * 60_000)}</b>
            <span>
              {eta} דק׳ <i>•</i> {fmtDist(left)}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
