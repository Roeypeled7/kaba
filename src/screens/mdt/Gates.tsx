import { useEffect, useState } from 'react';
import { stationShort } from '../../components/ui';
import type { Ctx } from './shared';

type GateState = 'closed' | 'opening' | 'open' | 'closing';
interface Gate {
  s: GateState;
  /** זמן אמת שבו התחיל המצב */
  at: number;
}

const MOVE_MS = 3500;
const AUTO_CLOSE_MS = 45_000;
const GATES = ['שער יציאה ראשי', 'שער חניון אחורי', 'מחסום כניסה'];
const LABEL: Record<GateState, string> = { closed: 'סגור', opening: 'נפתח…', open: 'פתוח', closing: 'נסגר…' };

/** השערים של כל תחנה נשמרים בזיכרון לאורך הניווט בטאבלט */
const memory = new Map<number, Gate[]>();

export default function Gates({ st, v }: Ctx) {
  const [gates, setGates] = useState<Gate[]>(() => memory.get(st.id) ?? GATES.map(() => ({ s: 'closed', at: 0 })));
  const [, tick] = useState(0);
  const now = Date.now();

  useEffect(() => {
    memory.set(st.id, gates);
  }, [gates, st.id]);

  // קידום מצבים: נפתח → פתוח → (סגירה אוטומטית) → נסגר → סגור
  useEffect(() => {
    const id = setInterval(() => {
      tick((n) => n + 1);
      setGates((gs) => {
        const t = Date.now();
        let changed = false;
        const next = gs.map((g) => {
          if (g.s === 'opening' && t - g.at >= MOVE_MS) return (changed = true), { s: 'open' as const, at: t };
          if (g.s === 'closing' && t - g.at >= MOVE_MS) return (changed = true), { s: 'closed' as const, at: t };
          if (g.s === 'open' && t - g.at >= AUTO_CLOSE_MS) return (changed = true), { s: 'closing' as const, at: t };
          return g;
        });
        return changed ? next : gs;
      });
    }, 150);
    return () => clearInterval(id);
  }, []);

  const set = (i: number, s: GateState) => setGates((gs) => gs.map((g, j) => (j === i ? { s, at: Date.now() } : g)));
  const atStation = v.status === 'available' || v.status === 'offline' || v.status === 'dispatched';

  return (
    <div className="mdt-page">
      <div className={`mdt-banner ${atStation ? '' : 'amber'}`}>
        תחנת {stationShort(st)} · {atStation ? 'הרכב בתחנה' : 'הרכב מחוץ לתחנה — ודאו שאין תנועה בשער לפני פתיחה'}
      </div>
      <div className="mdt-gates">
        {gates.map((g, i) => {
          const p = Math.min(1, (now - g.at) / MOVE_MS);
          const open = g.s === 'open' ? 1 : g.s === 'closed' ? 0 : g.s === 'opening' ? p : 1 - p;
          const left = g.s === 'open' ? Math.max(0, Math.ceil((AUTO_CLOSE_MS - (now - g.at)) / 1000)) : null;
          return (
            <section key={GATES[i]} className={`mdt-gate ${g.s}`}>
              <h3>{GATES[i]}</h3>
              <svg viewBox="0 0 220 120" className="mdt-gate-art">
                <rect x="0" y="108" width="220" height="12" fill="#3a3b3e" />
                <rect x="18" y="56" width="22" height="54" rx="3" fill="#cfd2d6" />
                <g transform={`rotate(${-80 * open} 29 62)`}>
                  <rect x="29" y="56" width="180" height="12" rx="6" fill="#fff" />
                  {[0, 1, 2, 3, 4].map((k) => (
                    <rect key={k} x={46 + k * 34} y="56" width="16" height="12" fill="#e53935" />
                  ))}
                </g>
                <circle cx="29" cy="62" r="7" fill="#8a8d92" />
                <circle cx="29" cy="42" r="6" fill={g.s === 'closed' ? '#ff3d2e' : g.s === 'open' ? '#c9d3de' : '#ffb020'} />
              </svg>
              <div className="mdt-gate-st">
                {LABEL[g.s]}
                {left !== null && <span className="mono"> · נסגר בעוד {left} שנ׳</span>}
              </div>
              <div className="mdt-gate-btns">
                <button className="mdt-btn cyan big" disabled={g.s === 'open' || g.s === 'opening'} onClick={() => set(i, 'opening')}>
                  פתיחה
                </button>
                <button className="mdt-btn big" disabled={g.s === 'closed' || g.s === 'closing'} onClick={() => set(i, 'closing')}>
                  סגירה
                </button>
              </div>
              {g.s === 'open' && (
                <button className="mdt-link" onClick={() => set(i, 'open')}>
                  השאר פתוח עוד 45 שנ׳
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
