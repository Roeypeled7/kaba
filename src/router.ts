/* ניתוב בנתיבים נקיים, בלי # — /kaba/102/events, /kaba/tablet/1-440/checks */
import { useEffect, useState } from 'react';

/** בסיס האתר: '/' בפיתוח, '/kaba/' ב-GitHub Pages (base של vite) */
export const BASE = import.meta.env.BASE_URL;
/** שורש עמוד הטאבלט */
export const TABLET_ROOT = `${BASE}tablet/`;

const NAV_EVENT = 'kaba:navigate';

/** מעבר מסך בלי טעינה מחדש — ההדמיה בחלון ממשיכה לרוץ */
export function navigate(to: string) {
  if (to === location.pathname + location.search) return;
  history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** הנתיב שאחרי השורש, מתחיל ב-'/': '/102/events' */
export function appPath(root: string): string {
  const p = location.pathname;
  return p.startsWith(root) ? `/${p.slice(root.length)}`.replace(/\/+$/, '') || '/' : '/';
}

export function usePath(root: string): string {
  const [path, setPath] = useState(() => appPath(root));
  useEffect(() => {
    const f = () => setPath(appPath(root));
    window.addEventListener('popstate', f);
    window.addEventListener(NAV_EVENT, f);
    return () => {
      window.removeEventListener('popstate', f);
      window.removeEventListener(NAV_EVENT, f);
    };
  }, [root]);
  return path;
}

/**
 * מתקן את הכתובת לפני שהאפליקציה עולה:
 * - ?p=/… — הפניה מ-404.html של GitHub Pages (קישור ישיר לנתיב פנימי)
 * - #/… — קישורים ישנים מלפני המעבר לנתיבים
 */
export function normalizeUrl(root: string) {
  const p = new URLSearchParams(location.search).get('p');
  const legacy = location.hash.startsWith('#/') ? location.hash.slice(1) : null;
  const rest = p ?? legacy;
  if (rest !== null) history.replaceState(null, '', root + rest.replace(/^\/+/, ''));
}

/** קישורים פנימיים (<a href>) עוברים מסך בלי טעינה מחדש; קישור לעמוד אחר (טאבלט ↔ משל״ט) נטען כרגיל */
export function interceptLinks(owns: (pathname: string) => boolean) {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !owns(url.pathname)) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  });
}

/** עמוד המשל״ט — כל מה שתחת הבסיס חוץ מהטאבלט */
export const ownsMain = (p: string) => p.startsWith(BASE) && !p.startsWith(TABLET_ROOT) && p !== TABLET_ROOT.slice(0, -1);
export const ownsTablet = (p: string) => p.startsWith(TABLET_ROOT);
