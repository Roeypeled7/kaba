import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { useEngine } from './engine/client';
import { Loading, PROFILES, SCREENS, parseRoute } from './components/ui';
import Launcher from './screens/Launcher';
import Dispatch from './screens/Dispatch';
import Comms from './screens/Comms';
import Station from './screens/Station';
import MapScreen from './screens/MapScreen';
import Events from './screens/Events';

function useHash() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const f = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return hash;
}

function App() {
  const { state, send, shared } = useEngine();
  const hash = useHash();
  // #/<תצוגה>/<מסך> (#/102/events, #/ops/station/3) — או מסך בלי תצוגה (#/dispatch)
  const { profile, path } = parseRoute(hash);
  const station = path.match(/^\/station\/(\d+)/);
  const stationName = station ? state?.stations.find((s) => s.id === +station[1])?.name : undefined;
  useEffect(() => {
    const prefix = profile ? PROFILES[profile].short : 'משל״ט';
    const s = (profile ? PROFILES[profile].screens : SCREENS).find((x) => x.path === path);
    document.title = station
      ? `${prefix} · עמדת ${stationName ?? `תחנה ${station[1]}`}`
      : s
        ? `${prefix} · ${s.title}`
        : 'משל״ט מחוזי — הדמיה';
  }, [hash, stationName]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state) return <Loading />;

  if (station) return <Station key={station[1]} state={state} send={send} id={+station[1]} />;
  switch (path) {
    case '/dispatch':
      return <Dispatch state={state} send={send} />;
    case '/events':
      return <Events state={state} send={send} />;
    case '/comms':
      return <Comms state={state} send={send} />;
    case '/map':
      return <MapScreen state={state} send={send} />;
    default:
      return <Launcher state={state} send={send} shared={shared} />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
