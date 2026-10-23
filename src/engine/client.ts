import { useEffect, useState } from 'react';
import { Engine } from './engine';
import { hostAudit } from './audit';
import type { Actor, AuditEntry, Command, SimState } from './model';

type Listener = (s: SimState) => void;
type AuditListener = (entries: AuditEntry[]) => void;

interface Connection {
  send: (cmd: Command) => void;
  subscribe: (fn: Listener) => () => void;
  subscribeAudit: (fn: AuditListener) => () => void;
  shared: boolean;
  latest: SimState | null;
  audit: AuditEntry[];
}

/** מזהה החלון הזה — חדש בכל טעינה (sessionStorage מועתק לחלונות שנפתחים מכאן, אז לא שם) */
export const WINDOW_ID = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** מי שולח את הפקודות מהחלון הזה — המוקדן המחובר, או הרכב בטאבלט */
let actor: Actor = {};
export function setActor(a: Actor) {
  actor = a;
}

let conn: Connection | null = null;

function connect(): Connection {
  const listeners = new Set<Listener>();
  const auditListeners = new Set<AuditListener>();
  const c: Connection = {
    latest: null,
    audit: [],
    shared: typeof SharedWorker !== 'undefined',
    send: () => {},
    subscribe: (fn) => {
      listeners.add(fn);
      if (c.latest) fn(c.latest);
      return () => listeners.delete(fn);
    },
    subscribeAudit: (fn) => {
      auditListeners.add(fn);
      fn(c.audit);
      return () => auditListeners.delete(fn);
    },
  };
  const publish = (s: SimState) => {
    c.latest = s;
    for (const l of listeners) l(s);
  };
  const publishAudit = (entries: AuditEntry[]) => {
    const seen = new Set(c.audit.map((e) => e.id));
    const fresh = entries.filter((e) => !seen.has(e.id));
    if (!fresh.length) return;
    c.audit = [...c.audit, ...fresh].sort((a, b) => a.at - b.at);
    for (const l of auditListeners) l(c.audit);
  };

  // מנוע מקומי — לדפדפן בלי SharedWorker, או כשה-worker לא עולה. אין סנכרון בין חלונות.
  const startLocal = () => {
    c.shared = false;
    const engine = new Engine();
    engine.subscribe((s) => publish(structuredClone(s)));
    publishAudit(hostAudit((fn) => engine.onAudit(fn), publishAudit)());
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      engine.tick(now - last);
      last = now;
    }, 400);
    c.send = (cmd) => engine.apply(cmd, actor);
    publish(structuredClone(engine.state));
  };

  if (!c.shared) {
    startLocal();
    return c;
  }
  try {
    const worker = new SharedWorker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name: 'kaba-engine' });
    const fallback = () => {
      if (!c.latest) {
        console.warn('SharedWorker לא עלה — עובר למנוע מקומי ללא סנכרון');
        startLocal();
      }
    };
    worker.onerror = fallback;
    setTimeout(fallback, 4000);
    worker.port.onmessage = (ev) => {
      if (!c.shared) return;
      if (ev.data.type === 'state') publish(ev.data.state);
      else if (ev.data.type === 'audit') publishAudit(ev.data.entries);
    };
    worker.port.start();
    c.send = (cmd) => worker.port.postMessage({ type: 'cmd', cmd, actor });
    window.addEventListener('pagehide', () => worker.port.postMessage({ type: 'bye', windowId: WINDOW_ID }));
  } catch {
    startLocal();
  }
  return c;
}

export function getConnection(): Connection {
  return (conn ??= connect());
}

export function useEngine(): { state: SimState | null; send: (cmd: Command) => void; shared: boolean } {
  const c = getConnection();
  const [state, setState] = useState<SimState | null>(c.latest);
  useEffect(() => c.subscribe(setState), [c]);
  return { state, send: c.send, shared: c.shared };
}

/** יומן המערכת המלא, מהישן לחדש */
export function useAudit(): AuditEntry[] {
  const c = getConnection();
  const [audit, setAudit] = useState<AuditEntry[]>(c.audit);
  useEffect(() => c.subscribeAudit(setAudit), [c]);
  return audit;
}
