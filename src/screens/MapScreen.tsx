import { useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, Tooltip } from 'react-leaflet';
import { AMB_STATUS_LABEL, DISTRICT, INCIDENT_TYPE, STATUS_LABEL } from '../engine/config';
import { nearestHospital } from '../engine/dispatch';
import type { Command, LatLng, SimState, VehicleStatus } from '../engine/model';
import { DarkTiles, FitDistrict, FlyTo, ambulanceIcon, hospitalIcon, incidentIcon, stationIcon, vehicleIcon } from '../components/mapkit';
import { IncidentBadge, IncidentTitle, TopBar, UnitTag, byUnit, fmtElapsed, stationShort, turnUnit } from '../components/ui';

type Layers = { stations: boolean; vehicles: boolean; incidents: boolean; ambulances: boolean; lines: boolean; idle: boolean };
const LAYER_LABEL: Record<keyof Layers, string> = {
  stations: 'תחנות',
  vehicles: 'רכבי כבאות',
  idle: 'רכבים בתחנה',
  incidents: 'אירועים',
  ambulances: 'מד״א',
  lines: 'קווי תנועה',
};

export default function MapScreen({ state }: { state: SimState; send: (c: Command) => void }) {
  const [layers, setLayers] = useState<Layers>({ stations: true, vehicles: true, incidents: true, ambulances: true, lines: true, idle: false });
  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const active = state.incidents.filter((i) => i.status !== 'closed');
  const moving = state.vehicles.filter((v) => layers.idle || (v.status !== 'available' && v.status !== 'offline'));
  const ambs = state.ambulances.filter((a) => a.status !== 'available');

  return (
    <div className="screen map-screen">
      <TopBar state={state} title="מפת מצב מחוזית" accent="#06d6a0" />
      <div className="map-wrap">
        <MapContainer center={[DISTRICT.center.lat, DISTRICT.center.lng]} zoom={DISTRICT.zoom} zoomSnap={0.25} preferCanvas>
          <DarkTiles />
          <FlyTo pos={focus} zoom={15} />
          <FitDistrict points={state.stations.map((s) => s.pos)} />
          {DISTRICT.hospitals.map((h) => (
            <Marker key={h.name} position={[h.pos.lat, h.pos.lng]} icon={hospitalIcon()} zIndexOffset={-400}>
              <Tooltip direction="top" offset={[0, -10]}>
                {h.name}
              </Tooltip>
            </Marker>
          ))}
          {layers.stations &&
            state.stations.map((st) => {
              const main = st.parentId === null;
              return (
                <Marker key={st.id} position={[st.pos.lat, st.pos.lng]} icon={stationIcon(st, stationShort(st))} zIndexOffset={main ? -100 : -200}>
                  <Popup>
                    <div className="map-pop">
                      <b>{st.name}</b>
                      {main ? (
                        <div>
                          בתור: <b className="mono">{turnUnit(st)}</b>
                        </div>
                      ) : (
                        <div className="dim small">תחנת משנה של {state.stations.find((s) => s.id === st.parentId)?.name}</div>
                      )}
                      <div className="pop-vehs">
                        {state.vehicles
                          .filter((v) => v.stationId === st.id)
                          .sort(byUnit)
                          .map((v) => (
                            <div key={v.id} className="pop-veh">
                              <span className="mono">{v.unit}</span>
                              <span className={`chip st-${v.status}`}>{STATUS_LABEL[v.status]}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          {layers.lines &&
            state.vehicles
              .filter((v) => v.status === 'enroute' || v.status === 'returning')
              .map((v) => {
                const target = v.status === 'enroute' ? state.incidents.find((i) => i.id === v.incidentId)?.pos : state.stations.find((s) => s.id === v.stationId)!.pos;
                if (!target) return null;
                return (
                  <Polyline
                    key={`l${v.id}`}
                    positions={[
                      [v.pos.lat, v.pos.lng],
                      [target.lat, target.lng],
                    ]}
                    pathOptions={{ color: v.status === 'enroute' ? '#ff9f1c' : '#4895ef', weight: 2, dashArray: '6 6', opacity: 0.8 }}
                  />
                );
              })}
          {layers.lines &&
            state.ambulances
              .filter((a) => a.status === 'enroute' || a.status === 'transporting')
              .map((a) => {
                const inc = state.incidents.find((i) => i.id === a.incidentId);
                // יעד הפינוי = בית החולים הקרוב לזירה (כמו במנוע); בלי אירוע — הקרוב לאמבולנס
                const target = a.status === 'enroute' ? inc?.pos : nearestHospital(inc?.pos ?? a.pos).pos;
                if (!target) return null;
                return (
                  <Polyline
                    key={`la${a.id}`}
                    positions={[
                      [a.pos.lat, a.pos.lng],
                      [target.lat, target.lng],
                    ]}
                    pathOptions={{ color: '#f8f9fa', weight: 1.5, dashArray: '3 6', opacity: 0.7 }}
                  />
                );
              })}
          {layers.incidents &&
            active.map((inc) => (
              <Marker
                key={inc.id}
                position={[inc.pos.lat, inc.pos.lng]}
                icon={incidentIcon(inc, sel === inc.id)}
                zIndexOffset={500}
                eventHandlers={{ click: () => setSel(inc.id) }}
              >
                <Popup>
                  <div className="map-pop">
                    <IncidentTitle inc={inc} />
                    <div>{inc.address}</div>
                    <IncidentBadge inc={inc} /> <span className="mono">{fmtElapsed(state.simTime - inc.openedAt)}</span>
                    <div className="preview-units">
                      {inc.vehicleIds
                        .map((id) => state.vehicles.find((v) => v.id === id)!)
                        .filter((v) => v.incidentId === inc.id)
                        .map((v) => (
                          <UnitTag key={v.id} v={v} />
                        ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          {layers.vehicles &&
            moving.map((v) => (
              <Marker key={v.id} position={[v.pos.lat, v.pos.lng]} icon={vehicleIcon(v)} zIndexOffset={1000}>
                <Tooltip direction="top" offset={[0, -10]}>
                  {v.callsign} · {STATUS_LABEL[v.status]}
                  {v.crewName ? ` · ${v.crewName}` : ''}
                </Tooltip>
              </Marker>
            ))}
          {layers.ambulances &&
            ambs.map((a) => (
              <Marker key={a.id} position={[a.pos.lat, a.pos.lng]} icon={ambulanceIcon(a)} zIndexOffset={900}>
                <Tooltip direction="top" offset={[0, -10]}>
                  {a.callsign} · {AMB_STATUS_LABEL[a.status]}
                </Tooltip>
              </Marker>
            ))}
        </MapContainer>

        <div className="map-overlay map-incidents">
          <h2>אירועים פעילים ({active.length})</h2>
          {!active.length && <div className="empty">שקט במחוז</div>}
          {active.map((inc) => (
            <button
              key={inc.id}
              className={`map-inc ${sel === inc.id ? 'on' : ''}`}
              onClick={() => {
                setSel(inc.id);
                setFocus({ ...inc.pos });
              }}
            >
              <span>
                {INCIDENT_TYPE[inc.typeKey].icon} <b>#{inc.id}</b> {INCIDENT_TYPE[inc.typeKey].label}
              </span>
              <span className="dim small">{inc.address}</span>
              <span className="row gap">
                <IncidentBadge inc={inc} />
                <span className="dim small">{inc.vehicleIds.filter((id) => state.vehicles.find((v) => v.id === id)?.incidentId === inc.id).length} כוחות</span>
              </span>
            </button>
          ))}
        </div>

        <div className="map-overlay map-legend">
          <h2>מקרא</h2>
          {(['dispatched', 'enroute', 'onscene', 'cleared', 'returning', 'available'] as VehicleStatus[]).map((s) => (
            <div key={s} className="legend-row">
              <span className={`swatch st-${s}`} /> {STATUS_LABEL[s]}
            </div>
          ))}
          <div className="legend-row">
            <span className="swatch amb" /> אמבולנס מד״א
          </div>
          <h2>שכבות</h2>
          {(Object.keys(layers) as (keyof Layers)[]).map((k) => (
            <label key={k} className="legend-row">
              <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {LAYER_LABEL[k]}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
