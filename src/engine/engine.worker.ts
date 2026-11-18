/// <reference lib="webworker" />
import { Engine } from './engine';
import { hostAudit } from './audit';
import { loadState, saveState } from './persist';

declare const self: SharedWorkerGlobalScope;

const engine = new Engine();
const ports = new Set<MessagePort>();
let last = performance.now();

setInterval(() => {
  const now = performance.now();
  engine.tick(now - last);
  last = now;
}, 400);

engine.subscribe((state) => {
  for (const p of ports) p.postMessage({ type: 'state', state });
});

// מצב ההדמיה נשמר כל כמה שניות ומשוחזר כשהמנוע עולה מחדש — רענון לא מוחק אירועים פעילים
let savedVersion = -1;
let ready = false;
loadState().then((saved) => {
  if (saved) engine.restore(saved);
  ready = true;
});
setInterval(() => {
  if (!ready || engine.state.version === savedVersion) return;
  savedVersion = engine.state.version;
  void saveState(engine.state);
}, 2000);

// יומן המערכת — נשמר ב-IndexedDB ונשלח לכל החלונות כתוספות
const auditLog = hostAudit(
  (fn) => engine.onAudit(fn),
  (entries) => {
    for (const p of ports) p.postMessage({ type: 'audit', entries });
  },
);

self.onconnect = (e: MessageEvent) => {
  const port = e.ports[0];
  ports.add(port);
  port.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'cmd') engine.apply(m.cmd, m.actor);
    else if (m.type === 'bye') {
      ports.delete(port);
      if (m.windowId) engine.apply({ type: 'windowClosed', windowId: m.windowId });
    }
  };
  port.start();
  port.postMessage({ type: 'state', state: engine.state });
  port.postMessage({ type: 'audit', entries: auditLog() });
};
