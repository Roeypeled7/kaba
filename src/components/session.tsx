/* כניסה למערכת, הפסקות ותפריט המוקדן — לכל חלונות המשל״ט (לא לטאבלט) */
import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { BREAK_REASON, DESK_LABEL, SESSION_TIMING } from '../engine/config';
import { WINDOW_ID, setActor } from '../engine/client';
import { fmtDuration } from '../engine/engine';
import type { BreakReason, Command, DeskId, Operator, SimState } from '../engine/model';
import { BASE } from '../router';

/** המוקדן של החלון הזה — נשמר לרענון, ומועתק לחלונות שנפתחים מכאן */
const BADGE_KEY = 'kaba.badge';
/** פרטי המשמרת של החלון — לחידוש כניסה אוטומטי אם המנוע עלה מחדש (כל החלונות נסגרו / רענון של חלון יחיד) */
const SHIFT_KEY = 'kaba.shift';
type Shift = { badge: string; name: string; desk: DeskId; loginAt: number; boot: string };
/** המוקדן האחרון בדפדפן — למילוי מהיר במסך הכניסה */
const LAST_KEY = 'kaba.lastOperator';

const DESKS = Object.keys(DESK_LABEL) as DeskId[];
const BREAKS = Object.keys(BREAK_REASON) as BreakReason[];

function read<T>(store: () => Storage, key: string): T | null {
  try {
    const raw = store().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(store: () => Storage, key: string, v: unknown) {
  try {
    if (v === null) store().removeItem(key);
    else store().setItem(key, JSON.stringify(v));
  } catch {
    /* אחסון חסום — הכניסה תחזיק רק עד רענון */
  }
}
const ss = () => sessionStorage;
const ls = () => localStorage;

export interface Session {
  /** המוקדן המחובר בחלון הזה; null = מסך כניסה */
  me: Operator | null;
  /** המספר האישי האחרון בחלון — גם אם המוקדן כבר נותק (למילוי מסך הכניסה) */
  badge: string | null;
  /** חידוש כניסה אוטומטי בדרך — לא להציג מסך כניסה */
  resuming: boolean;
  login: (badge: string, name: string, desk: DeskId) => void;
  logout: (badge?: string) => void;
  setBreak: (reason: BreakReason | null, badge?: string) => void;
}

export function useSession(state: SimState | null, send: (c: Command) => void): Session {
  const [badge, setBadge] = useState<string | null>(() => {
    const b = read<string>(ss, BADGE_KEY);
    setActor(b ? { badge: b } : {});
    return b;
  });
  const me = (badge && state?.operators.find((o) => o.badge === badge)) || null;

  // המנוע עלה מחדש מאז הכניסה — המוקדן לא התנתק, רק המנוע. נכנסים שוב בשקט.
  // באותה הפעלה של המנוע, מוקדן שנעלם = יצא או נותק → מסך כניסה
  const resumed = useRef(false);
  useEffect(() => {
    if (!state || !badge) return;
    if (me) {
      write(ss, SHIFT_KEY, { badge, name: me.name, desk: me.desk, loginAt: me.loginAt, boot: state.bootId } satisfies Shift);
      return;
    }
    const shift = read<Shift>(ss, SHIFT_KEY);
    if (resumed.current || !shift || shift.badge !== badge || shift.boot === state.bootId) return;
    resumed.current = true;
    send({ type: 'login', badge, name: shift.name, desk: shift.desk, windowId: WINDOW_ID, resume: { loginAt: shift.loginAt } });
  }, [state?.bootId, badge, me?.name, me?.desk, me?.loginAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // פעימה — כל עוד החלון פתוח, המוקדן נשאר מחובר
  const present = !!me;
  useEffect(() => {
    if (!badge || !present) return;
    const beat = () => send({ type: 'heartbeat', badge, windowId: WINDOW_ID });
    beat();
    const id = setInterval(beat, SESSION_TIMING.heartbeatMs);
    return () => clearInterval(id);
  }, [badge, present, send]);

  const shift = read<Shift>(ss, SHIFT_KEY);
  const resuming = !me && !!state && !!badge && shift?.badge === badge && shift.boot !== state.bootId;

  return {
    me,
    badge,
    resuming,
    login: (b, name, desk) => {
      setActor({ badge: b });
      write(ss, BADGE_KEY, b);
      write(ls, LAST_KEY, { badge: b, name, desk });
      setBadge(b);
      send({ type: 'login', badge: b, name, desk, windowId: WINDOW_ID });
    },
    logout: (b = badge ?? undefined) => {
      if (!b) return;
      send({ type: 'logout', badge: b });
      if (b !== badge) return;
      write(ss, BADGE_KEY, null);
      write(ss, SHIFT_KEY, null);
      setActor({});
      setBadge(null);
    },
    setBreak: (reason, b = badge ?? undefined) => b && send({ type: 'setBreak', badge: b, reason }),
  };
}

export const SessionContext = createContext<Session | null>(null);
export const useSessionCtx = () => useContext(SessionContext);

/** שעון אמת שמתעדכן — לטיימרים של הפסקה ומשמרת (ההדמיה יכולה להיות מושהית) */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export const breakOver = (op: Operator, now: number) => !!op.onBreak && now - op.statusSince > BREAK_REASON[op.onBreak].limitMin * 60_000;

/* ── מסך כניסה ── */

export function Login({ state, session, desk: routeDesk }: { state: SimState; session: Session; desk: DeskId | null }) {
  const last = read<{ badge: string; name: string; desk: DeskId }>(ls, LAST_KEY);
  const [badge, setBadge] = useState(session.badge ?? last?.badge ?? '');
  const [name, setName] = useState(session.badge && session.badge !== last?.badge ? '' : last?.name ?? '');
  const [desk, setDesk] = useState<DeskId>(routeDesk ?? last?.desk ?? '102');
  const [pending, setPending] = useState(false);
  const existing = state.operators.find((o) => o.badge === badge.trim());
  const badgeOk = /^\d{4,8}$/.test(badge.trim());
  const nameOk = !!existing || name.trim().length >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!badgeOk || !nameOk) return;
    setPending(true);
    session.login(badge.trim(), existing?.name ?? name.trim(), existing?.desk ?? desk);
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-head">
          <span className="logo">🚒</span>
          <div>
            <div className="t1">כניסה למערכת</div>
            <div className="dim small">משל״ט מחוזי — הדמיה</div>
          </div>
        </div>
        {session.badge && !session.me && <div className="warn">המשמרת של מס׳ {session.badge} הסתיימה או נותקה — צריך להיכנס מחדש</div>}

        <label className="login-field">
          <span className="lbl">מספר אישי</span>
          <input className="mono" inputMode="numeric" autoComplete="off" autoFocus={!badge} value={badge} onChange={(e) => setBadge(e.target.value.replace(/\D/g, ''))} placeholder="4–8 ספרות" />
        </label>
        {existing ? (
          <div className="login-join">
            מחובר כבר כ־<b>{existing.name}</b> · {DESK_LABEL[existing.desk]} — החלון יצטרף למשמרת שלו
          </div>
        ) : (
          <>
            <label className="login-field">
              <span className="lbl">שם מלא</span>
              <input autoComplete="name" autoFocus={!!badge && !name} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="login-field">
              <span className="lbl">עמדה</span>
              <div className="seg login-desks">
                {DESKS.map((d) => (
                  <button key={d} type="button" className={desk === d ? 'on' : ''} onClick={() => setDesk(d)}>
                    {DESK_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button className="btn fire big" disabled={!badgeOk || !nameOk || pending}>
          {pending ? 'מתחבר…' : existing ? 'הצטרפות למשמרת' : 'כניסה'}
        </button>

        {state.operators.length > 0 && (
          <div className="login-online">
            <span className="lbl">מחוברים עכשיו</span>
            {state.operators.map((o) => (
              <button key={o.badge} type="button" className="login-op" onClick={() => setBadge(o.badge)}>
                <span className={`op-dot ${o.onBreak ? 'brk' : 'on'}`} />
                {o.name} <span className="mono dim">{o.badge}</span>
                <span className="dim small push">{o.onBreak ? `${BREAK_REASON[o.onBreak].icon} ${BREAK_REASON[o.onBreak].label}` : DESK_LABEL[o.desk]}</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}

/* ── הפסקה: החלון ננעל עד החזרה לעמדה ── */

export function BreakScreen({ session }: { session: Session }) {
  const now = useNow();
  const me = session.me!;
  const r = BREAK_REASON[me.onBreak!];
  const over = breakOver(me, now);
  return (
    <div className="break-overlay">
      <div className={`break-card ${over ? 'over' : ''}`}>
        <div className="break-ico">{r.icon}</div>
        <div className="t1">{me.name} בהפסקה</div>
        <div className="dim">{r.label} · עד {r.limitMin} דק׳</div>
        <div className="break-timer mono">{fmtDuration(now - me.statusSince)}</div>
        {over && <div className="break-over">חריגה של {Math.floor((now - me.statusSince) / 60_000) - r.limitMin} דק׳</div>}
        <div className="dim small">העמדה נעולה — פעולות מהחלון הזה לא מבוצעות עד החזרה</div>
        <button className="btn ok big" onClick={() => session.setBreak(null)}>
          חזרה לעמדה
        </button>
        <button className="btn ghost sm" onClick={() => confirm('לצאת מהמערכת ולסיים משמרת?') && session.logout()}>
          יציאה מהמערכת
        </button>
      </div>
    </div>
  );
}

/* ── תפריט המוקדן בפס העליון ── */

export function OperatorMenu() {
  const session = useSessionCtx();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const now = useNow(open ? 1000 : 30_000);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const me = session?.me;
  if (!session || !me) return null;
  return (
    <div className="op-menu" ref={ref}>
      <button className="btn ghost sm op-btn" onClick={() => setOpen(!open)} title="מוקדן מחובר — הפסקה ויציאה">
        <span className={`op-dot ${me.onBreak ? 'brk' : 'on'}`} />
        {me.name}
        <span className="mono dim">{me.badge}</span>
      </button>
      {open && (
        <div className="op-pop">
          <div className="op-pop-head">
            <b>{me.name}</b>
            <span className="dim small">
              {DESK_LABEL[me.desk]} · משמרת {fmtDuration(now - me.loginAt)}
              {me.breaks > 0 && ` · ${me.breaks} הפסקות (${fmtDuration(me.breakMs)})`}
            </span>
          </div>
          <span className="lbl">יציאה להפסקה</span>
          <div className="op-breaks">
            {BREAKS.map((r) => (
              <button
                key={r}
                className="btn sm"
                onClick={() => {
                  session.setBreak(r);
                  setOpen(false);
                }}
              >
                {BREAK_REASON[r].icon} {BREAK_REASON[r].label}
                <span className="dim small">{BREAK_REASON[r].limitMin}′</span>
              </button>
            ))}
          </div>
          <a className="btn ghost sm" href={`${BASE}log`}>
            🗂 יומן מערכת ולוח משמרת
          </a>
          <button className="btn danger sm" onClick={() => confirm('לצאת מהמערכת ולסיים משמרת?') && session.logout()}>
            יציאה מהמערכת
          </button>
        </div>
      )}
    </div>
  );
}
