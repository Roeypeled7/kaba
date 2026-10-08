/// <reference lib="webworker" />
import { Engine } from './engine';

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

self.onconnect = (e: MessageEvent) => {
  const port = e.ports[0];
  ports.add(port);
  port.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'cmd') engine.apply(m.cmd);
    else if (m.type === 'bye') ports.delete(port);
  };
  port.start();
  port.postMessage({ type: 'state', state: engine.state });
};
