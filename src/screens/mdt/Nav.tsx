import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import { INCIDENT_TYPE, STATUS_LABEL, UNIT_SPEED_KMH } from '../../engine/config';
import { distKm } from '../../engine/dispatch';
import { etaMin } from '../../engine/simulation';
import type { Incident, LatLng } from '../../engine/model';
import { incidentIcon, vehicleIcon } from '../../components/mapkit';
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

const meIcon = (bearing: number) =>
  L.divIcon({ className: '', html: `<div class="mdt-nav-me" style="transform: rotate(${bearing}deg)"><i></i></div>`, iconSize: [84, 84], iconAnchor: [42, 42] });
const streetIcon = (name: string) => L.divIcon({ className: '', html: `<div class="mdt-nav-street">${name.replace(/[<>&]/g, '')}</div>`, iconSize: [0, 0], iconAnchor: [0, 0] });

/** אריחי OpenStreetMap — הגוון הכהה של Waze נעשה ב-CSS (nav.css) */
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const FOLLOW_ZOOM = 18;

/** בנסיעה — המפה עוקבת אחרי הרכב מקרוב, והרכב בשליש התחתון; לפני היציאה — המסלול כולו; אחרי ההגעה — הזירה */
function Camera({ mode, pos, bounds }: { mode: 'follow' | 'overview' | 'scene'; pos: LatLng; bounds: L.LatLngBounds }) {
  const map = useMap();
  const key = mode === 'follow' ? `${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}` : bounds.toBBoxString();
  useEffect(() => {
    if (mode === 'follow') {
      const p = map.project([pos.lat, pos.lng], FOLLOW_ZOOM).subtract([0, map.getSize().y * 0.3]);
      map.setView(map.unproject(p, FOLLOW_ZOOM), FOLLOW_ZOOM, { animate: true });
    } else if (mode === 'scene') map.setView(bounds.getCenter(), 17, { animate: true });
    else {
      // המשטח המוטה גדול מהמסגרת — המסלול צריך להיכנס לחלק התחתון-מרכזי שלו, שהוא מה שנראה
      const { x, y } = map.getSize();
      map.fitBounds(bounds, { paddingTopLeft: [x * 0.36, y * 0.62], paddingBottomRight: [x * 0.36, y * 0.1], maxZoom: 16, animate: false });
    }
  }, [mode, key]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const me = along(route, done);
  const left = route.total - done;
  const eta = etaMin(v.pos, inc.pos, UNIT_SPEED_KMH[v.type]);

  // התמרון הבא: סוף המקטע שבו הרכב נמצא עכשיו
  let acc = 0;
  let idx = 0;
  while (idx < route.steps.length - 1 && acc + route.steps[idx].km <= done) acc += route.steps[idx++].km;
  const next = route.steps[Math.min(idx + 1, route.steps.length - 1)];
  const toNext = Math.max(0, acc + route.steps[idx].km - done);
  const ins = instruction(next);

  const line = route.pts.map((p) => [p.lat, p.lng] as [number, number]);
  const cut = route.cum.findIndex((c) => c > done);
  const ahead: [number, number][] = [[me.pos.lat, me.pos.lng], ...line.slice(cut < 0 ? line.length : cut)];
  const bounds = useMemo(() => (arrived ? L.latLngBounds([inc.pos.lat, inc.pos.lng], [inc.pos.lat, inc.pos.lng]) : L.latLngBounds(line)), [arrived, route]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = state.vehicles.filter((x) => x.incidentId === inc.id && x.id !== v.id);

  // שמות הרחובות הבאים על המסלול — תוויות כמו ב-Waze
  const streets: { name: string; at: LatLng }[] = [];
  for (let i = idx + 1; i < route.steps.length && streets.length < 3; i++) {
    const st2 = route.steps[i];
    if (st2.name && st2.at && st2.type !== 'arrive' && !streets.some((x) => x.name === st2.name)) streets.push({ name: st2.name, at: st2.at });
  }
  const speed = driving && left > 0.02 ? UNIT_SPEED_KMH[v.type] : 0;
  const nextName = next.type === 'arrive' ? inc.address : next.name;

  return (
    <section className="mdt-nav waze">
      {/* המפה מוטה לאחור (מבט נהג) — גדולה מהמסגרת כדי למלא אותה גם אחרי ההטיה */}
      <div className="mdt-nav-tilt">
        <MapContainer center={[inc.pos.lat, inc.pos.lng]} zoom={14} zoomControl={false} attributionControl={false}>
          <TileLayer url={TILES} maxZoom={19} />
          <Camera mode={driving ? 'follow' : arrived ? 'scene' : 'overview'} pos={me.pos} bounds={bounds} />
          {!arrived && (
            <>
              <Polyline positions={ahead} pathOptions={{ color: '#0e86b8', weight: 34, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
              <Polyline positions={ahead} pathOptions={{ color: '#2fd6ff', weight: 24, lineCap: 'round', lineJoin: 'round' }} />
            </>
          )}
          {!arrived && streets.map((x) => <Marker key={x.name} position={[x.at.lat, x.at.lng]} icon={streetIcon(x.name)} interactive={false} />)}
          <Marker position={[inc.pos.lat, inc.pos.lng]} icon={incidentIcon(inc, true)} />
          {others.map((x) => (
            <Marker key={x.id} position={[x.pos.lat, x.pos.lng]} icon={vehicleIcon(x)} />
          ))}
          <Marker position={[me.pos.lat, me.pos.lng]} icon={meIcon(me.bearing)} zIndexOffset={500} />
        </MapContainer>
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
