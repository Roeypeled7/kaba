import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** GitHub Pages מגיש את האתר תחת /kaba/ */
const PAGES_BASE = '/kaba/';

/** נתיב פנימי של הטאבלט (/tablet/1-440/checks) → העמוד של הטאבלט, בשרת הפיתוח וב-preview */
function tabletFallback(base: string): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const path = req.url?.split('?')[0] ?? '';
    if (path.startsWith(`${base}tablet/`) && !/\.[a-z0-9]+$/i.test(path)) req.url = `${base}tablet/index.html`;
    next();
  };
}

/**
 * ניתוב בנתיבים נקיים (בלי #): GitHub Pages לא מכיר נתיבים כמו /kaba/102/events ומגיש 404.html.
 * ה-404.html מעביר לעמוד הנכון (משל״ט או טאבלט) עם הנתיב ב-?p=, והאפליקציה מחזירה את הכתובת הנקייה.
 */
function cleanUrls(): Plugin {
  let base = '/';
  return {
    name: 'kaba-clean-urls',
    configResolved(c) {
      base = c.base;
    },
    configureServer(server) {
      server.middlewares.use(tabletFallback(base));
    },
    configurePreviewServer(server) {
      server.middlewares.use(tabletFallback(base));
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <title>מעביר…</title>
    <script>
      (function () {
        var base = ${JSON.stringify(base)}, tablet = base + 'tablet/', p = location.pathname;
        var root = p.indexOf(tablet) === 0 || p === base + 'tablet' ? tablet : base;
        var rest = p.indexOf(root) === 0 ? p.slice(root.length) : '';
        location.replace(root + '?p=' + encodeURIComponent('/' + rest) + location.hash);
      })();
    </script>
  </head>
  <body></body>
</html>
`,
      });
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react(), cleanUrls()],
  // נתיבים מוחלטים — נדרש כשהכתובת עצמה עמוקה (/kaba/102/events). בפיתוח: שורש השרת
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  server: { port: 5180 },
  // שני עמודים: המשל״ט (/) והטאבלט (/tablet/) — אותו מנוע, קישור נפרד
  build: { rollupOptions: { input: { main: 'index.html', tablet: 'tablet/index.html' } } },
  worker: { format: 'es' },
}));
