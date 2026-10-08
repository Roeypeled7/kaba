import { useEffect, useState } from 'react';
import { Engine } from './engine';
import type { Command, SimState } from './model';

type Listener = (s: SimState) => void;

interface Connection {
  send: (cmd: Command) => void;
  subscribe: (fn: Listener) => () => void;
  shared: boolean;
  latest: SimState | null;
}

let conn: Connection | null = null;

function connect(): Connection {
  const listeners = new Set<Listener>();
  const c: Connection = {
    latest: null,
    shared: typeof SharedWorker !== 'undefined',
    send: () => {},
    subscribe: (fn) => {
      listeners.add(fn);
      if (c.latest) fn(c.latest);
      return () => listeners.delete(fn);
    },
  };
  const publish = (s: SimState) => {
    c.latest = s;
    for (const l of listeners) l(s);
  };

  if (c.shared) {
    const worker = new SharedWorker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name: 'kaba-engine' });
    worker.port.onmessage = (ev) => {
      if (ev.data.type === 'state') publish(ev.data.state);
    };
    worker.port.start();
    c.send = (cmd) => worker.port.postMessage({ type: 'cmd', cmd });
    window.addEventListener('pagehide', () => worker.port.postMessage({ type: 'bye' }));
  } else {
    // דפדפן בלי SharedWorker — מנוע מקומי, ללא סנכרון בין חלונות
    const engine = new Engine();
    engine.subscribe((s) => publish(structuredClone(s)));
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      engine.tick(now - last);
      last = now;
    }, 400);
    c.send = (cmd) => engine.apply(cmd);
    publish(structuredClone(engine.state));
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
