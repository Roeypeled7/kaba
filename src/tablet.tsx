/* נקודת כניסה נפרדת לטאבלט הרכב — /tablet/ . מתחבר לאותו מנוע הדמיה כמו המשל״ט */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { useEngine } from './engine/client';
import { Loading } from './components/ui';
import Tablet from './screens/mdt/Tablet';

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
  const { state, send } = useEngine();
  const hash = useHash();
  // #/<vehicleId>/<screen>/<sub> — למשל #/1-440/checks/daily
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  useEffect(() => {
    document.title = `טאבלט · ${path[0] ? decodeURIComponent(path[0]) : 'בחירת רכב'}`;
  }, [path[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state) return <Loading />;
  return <Tablet key={path[0] ?? ''} state={state} send={send} path={path} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
