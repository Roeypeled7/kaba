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

const TYPE_GLYPH: Record<Vehicle['type'], string> = { engine: '▲', tanker: '■', rescue: '✦', commander: '★' };

export function vehicleIcon(v: Vehicle) {
  const short = v.callsign.replace(/^[^\d]*\s/, '');
  return icon(`v:${v.id}:${v.status}`, `<div class="mk-veh st-${v.status}"><b>${TYPE_GLYPH[v.type]}</b>${short}</div>`, [52, 20]);
}

export function stationIcon(st: Station) {
  return icon(`s:${st.id}`, `<div class="mk-station"><span>🚒</span>${st.name.replace('תחנת ', '')}</div>`, [96, 26]);
}

export function incidentIcon(inc: Incident, selected = false) {
  const t = INCIDENT_TYPE[inc.typeKey];
  return icon(`i:${inc.typeKey}:${inc.status}:${selected}`, `<div class="mk-inc inc-${inc.status} ${selected ? 'sel' : ''}"><span>${t.icon}</span></div>`, [40, 40]);
}

export function ambulanceIcon(a: Ambulance) {
  const short = a.callsign.replace(/^[^\d]*\s/, '');
  return icon(`a:${a.id}:${a.status}`, `<div class="mk-amb amb-${a.status}"><b>✚</b>${short}</div>`, [58, 20]);
}

export const hospitalIcon = () => icon('hospital', `<div class="mk-hosp">H</div>`, [24, 24]);
export const pinIcon = () => icon('pin', `<div class="mk-pin"></div>`, [22, 22]);

/** מזיז את המפה כשהמרכז משתנה */
export function FlyTo({ pos, zoom }: { pos: LatLng | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo([pos.lat, pos.lng], zoom ?? map.getZoom(), { duration: 0.6 });
  }, [pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
