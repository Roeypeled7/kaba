/* נקודת כניסה נפרדת לטאבלט הרכב — /tablet/ . מתחבר לאותו מנוע הדמיה כמו המשל״ט */
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { setActor, useEngine } from './engine/client';
import { TABLET_ROOT, interceptLinks, normalizeUrl, ownsTablet, usePath } from './router';
import { Loading } from './components/ui';
import Tablet from './screens/mdt/Tablet';

function App() {
  const { state, send } = useEngine();
  const route = usePath(TABLET_ROOT);
  // /<vehicleId>/<screen>/<sub> — למשל tablet/1-440/checks/daily
  const path = route.split('/').filter(Boolean);
  // פעולות מהטאבלט נרשמות ביומן בשם הרכב
  setActor(path[0] ? { vehicleId: decodeURIComponent(path[0]) } : {});
  useEffect(() => {
    document.title = `טאבלט · ${path[0] ? decodeURIComponent(path[0]) : 'בחירת רכב'}`;
  }, [path[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state) return <Loading />;
  return <Tablet key={path[0] ?? ''} state={state} send={send} path={path} />;
}

normalizeUrl(TABLET_ROOT);
interceptLinks(ownsTablet);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
