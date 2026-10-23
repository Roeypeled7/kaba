import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { useEngine } from './engine/client';
import { BASE, interceptLinks, normalizeUrl, ownsMain, usePath } from './router';
import { Loading, PROFILES, SCREENS, parseRoute } from './components/ui';
import { BreakScreen, Login, SessionContext, useSession } from './components/session';
import Launcher from './screens/Launcher';
import Dispatch from './screens/Dispatch';
import Comms from './screens/Comms';
import Station from './screens/Station';
import MapScreen from './screens/MapScreen';
import Events from './screens/Events';
import Log from './screens/Log';

function App() {
  const { state, send, shared } = useEngine();
  const route = usePath(BASE);
  // /<תצוגה>/<מסך> (/102/events, /ops/station/3) — או מסך בלי תצוגה (/dispatch)
  const { profile, path } = parseRoute(route);
  const session = useSession(state, send);
  const station = path.match(/^\/station\/(\d+)/);
  const stationName = station ? state?.stations.find((s) => s.id === +station[1])?.name : undefined;
  useEffect(() => {
    const prefix = profile ? PROFILES[profile].short : 'משל״ט';
    const s = (profile ? PROFILES[profile].screens : SCREENS).find((x) => x.path === path);
    document.title = station
      ? `${prefix} · עמדת ${stationName ?? `תחנה ${station[1]}`}`
      : s
        ? `${prefix} · ${s.title}`
        : path === '/log'
          ? `${prefix} · יומן מערכת`
          : 'משל״ט מחוזי — הדמיה';
  }, [route, stationName]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state || session.resuming) return <Loading />;
  // כל המשל״ט מאחורי כניסה; הטאבלט — עמוד נפרד, בלי כניסת מוקדן
  if (!session.me) return <Login state={state} session={session} desk={profile} />;

  return (
    <SessionContext.Provider value={session}>
      {screen()}
      {session.me.onBreak && <BreakScreen session={session} />}
    </SessionContext.Provider>
  );

  function screen() {
    if (!state) return null;
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
      case '/log':
        return <Log state={state} />;
      default:
        return <Launcher state={state} send={send} shared={shared} />;
    }
  }
}

normalizeUrl(BASE);
interceptLinks(ownsMain);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
