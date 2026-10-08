import L from 'leaflet';
import { useEffect } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { INCIDENT_TYPE } from '../engine/config';
import type { Ambulance, Incident, LatLng, Station, Vehicle } from '../engine/model';

export function DarkTiles() {
  return (
    <TileLayer
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      maxZoom={19}
    />
  );
}

const cache = new Map<string, L.DivIcon>();
function icon(key: string, html: string, size: [number, number], anchor?: [number, number]): L.DivIcon {
  let i = cache.get(key);
  if (!i) {
    i = L.divIcon({ className: 'mk', html, iconSize: size, iconAnchor: anchor ?? [size[0] / 2, size[1] / 2] });
    cache.set(key, i);
  }
  return i;
}

const TYPE_GLYPH: Record<Vehicle['type'], string> = { engine: '▲', ladder: '⇡', tanker: '■', commander: '★' };

export function vehicleIcon(v: Vehicle) {
  return icon(`v:${v.id}:${v.status}`, `<div class="mk-veh st-${v.status}"><b>${TYPE_GLYPH[v.type]}</b>${v.unit}</div>`, [52, 20]);
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** תחנה ראשית — בולטת; תחנת משנה — נקודה קטנה ושם עמום. התווית ממורכזת על הנקודה בלי תלות ברוחב השם. */
export function stationIcon(st: Station, short: string) {
  if (st.parentId === null)
    return icon(`s:${st.id}`, `<div class="mk-station"><span>🚒</span>${esc(short)}</div>`, [0, 0], [0, 0]);
  return icon(`s:${st.id}`, `<div class="mk-sub"><i></i><span>${esc(short)}</span></div>`, [0, 0], [0, 0]);
}

export function incidentIcon(inc: Incident, selected = false) {
  const t = INCIDENT_TYPE[inc.typeKey];
  return icon(`i:${inc.typeKey}:${inc.status}:${selected}`, `<div class="mk-inc inc-${inc.status} ${selected ? 'sel' : ''}"><span>${t.icon}</span></div>`, [40, 40]);
}

export function ambulanceIcon(a: Ambulance) {
  const short = a.callsign.replace(/^[^\d]*\s/, '');
  return icon(`a:${a.id}:${a.status}`, `<div class="mk-amb amb-${a.status}"><b>✚</b>${short}</div>`, [58, 20]);
}

export const hospitalIcon = () => icon('hospital', `<div class="mk-hosp">H</div>`, [18, 18]);
export const pinIcon = () => icon('pin', `<div class="mk-pin"></div>`, [22, 22]);

/** מזיז את המפה כשהמרכז משתנה */
export function FlyTo({ pos, zoom }: { pos: LatLng | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo([pos.lat, pos.lng], zoom ?? map.getZoom(), { duration: 0.6 });
  }, [pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** פותח במרכז/זום של הקונפיג, ואם נקודות המחוז לא נכנסות במסך — מתרחק עד שכולן נראות */
export function FitDistrict({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (!map.getBounds().contains(b)) map.fitBounds(b, { padding: [24, 24], animate: false });
  }, [points.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
