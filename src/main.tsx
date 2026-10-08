import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { useEngine } from './engine/client';
import { Loading, SCREENS } from './components/ui';
import Launcher from './screens/Launcher';
import Dispatch from './screens/Dispatch';
import Comms from './screens/Comms';
import Station from './screens/Station';
import MapScreen from './screens/MapScreen';

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
  const station = hash.match(/^#\/station\/(\d+)/);
  const stationName = station ? state?.stations.find((s) => s.id === +station[1])?.name : undefined;
  useEffect(() => {
    const s = SCREENS.find((x) => x.hash === hash);
    document.title = station
      ? `משל״ט · עמדת ${stationName ?? `תחנה ${station[1]}`}`
      : s
        ? `משל״ט · ${s.title}`
        : 'משל״ט מחוזי — הדמיה';
  }, [hash, stationName]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state) return <Loading />;

  if (station) return <Station key={station[1]} state={state} send={send} id={+station[1]} />;
  switch (hash) {
    case '#/dispatch':
      return <Dispatch state={state} send={send} />;
    case '#/comms':
      return <Comms state={state} send={send} />;
    case '#/map':
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
