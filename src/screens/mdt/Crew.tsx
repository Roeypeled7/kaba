import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { CREW_ROLE_LABEL, buildWorld } from '../../engine/config';
import type { CrewMember, CrewRole } from '../../engine/model';
import { IcCommander, IcWheel } from './icons';
import { Avatar, splitName, stationPeople, useLocal, type Ctx } from './shared';
import './crew.css';

const ROLE_RANK: Record<CrewRole, number> = { commander: 0, driver: 1, firefighter: 2 };
const sortCrew = (c: CrewMember[]) => [...c].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]);

/**
 * הקצין הקבוע של כל רכב פיקוד (41/475), כפי שנזרע ב-buildWorld.
 * לא נשענים על v.crewName: המנוע דורס אותו בכל שיבוץ (מפקד, או הראשון ברשימה), ולכן הוא לא מקור אמין ל"מי מוגדר כמפקד".
 */
let seedOfficers: Map<string, string> | null = null;
function seedOfficer(vehicleId: string): string | undefined {
  seedOfficers ??= new Map(
    buildWorld(0)
      .vehicles.filter((x) => x.type === 'commander' && x.crewName)
      .map((x) => [x.id, x.crewName as string]),
  );
  return seedOfficers.get(vehicleId);
}

/** גרירה: מתחילה אחרי תזוזה של 8px (עכבר / החלקה אופקית במגע) או אחרי לחיצה ארוכה של 200ms במגע */
const DRAG_PX = 8;
const HOLD_MS = 200;
type DragKind = 'pool' | 'crew';
interface Gesture {
  id: number;
  kind: DragKind;
  name: string;
  x0: number;
  y0: number;
  x: number;
  y: number;
  touch: boolean;
  el: HTMLElement;
  timer: number | null;
  active: boolean;
}
interface Drag {
  kind: DragKind;
  name: string;
  touch: boolean;
  /** קנה המידה של מסך הטאבלט (transform: scale על .mdt-device) — הרוח מצוירת מחוץ לו, ב-body */
  scale: number;
  font: string;
}
type Over = 'ok' | 'bad' | null;

/** בזמן גרירה במגע — לא נותנים לרשימה להיגלל */
const blockScroll = (e: TouchEvent) => e.preventDefault();
const ghostTransform = (x: number, y: number, d: Pick<Drag, 'touch' | 'scale'>) =>
  // במגע הרוח מוצגת מעל האצבע, כדי שלא תוסתר
  `translate3d(${x}px, ${y}px, 0) translate(-50%, ${d.touch ? '-115%' : '-55%'}) scale(${d.scale})`;

export default function Crew({ state, send, v, st }: Ctx) {
  const [extra, setExtra] = useLocal<string[]>(`kaba.mdt.extra.${st.id}`, () => []);
  const [sel, setSel] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'role' | 'add' | null>(null);
  const [newName, setNewName] = useState('');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<Over>(null);
  const gesture = useRef<Gesture | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ghostRef = useRef<HTMLDivElement>(null);
  const crewRef = useRef<HTMLElement>(null);
  const poolRef = useRef<HTMLElement>(null);
  const suppressClick = useRef(false);
  const max = v.type === 'commander' ? 2 : v.type === 'engine' ? 5 : 3;

  const assigned = new Set(state.vehicles.filter((x) => x.stationId === st.id).flatMap((x) => x.crew.map((m) => m.name)));
  const pool = stationPeople(state, st, extra).filter((n) => !assigned.has(n));
  const crew = sortCrew(v.crew);
  const full = crew.length >= max;

  // מי רשאי לשמש מפקד צוות ברכב הזה: מפקדי הצוותים של התחנה, וברכב פיקוד — גם הקצין הקבוע של הרכב.
  // מי שכבר מחזיק בתפקיד נשאר מוכר, כדי שלא יורד בדרגה בשקט.
  const commanders = new Set<string>();
  for (const tid of st.teamOrder) {
    const t = st.teams[tid];
    if (t) commanders.add(t.leader);
  }
  if (v.type === 'commander') {
    const officer = seedOfficer(v.id);
    if (officer) commanders.add(officer);
  }
  v.crew.forEach((m) => m.role === 'commander' && commanders.add(m.name));
  const canCommand = (name: string) => commanders.has(name);

  const commander = crew.find((m) => m.role === 'commander');
  const isCommander = (name: string) => commander?.name === name;
  /** מפקד צוות שמשובץ לרכב שכבר יש בו מפקד — מחליף אותו (תמיד מפקד אחד ברכב) */
  const swaps = (name: string) => canCommand(name) && !!commander;
  const canAdd = (name: string) => !crew.some((m) => m.name === name) && (!full || swaps(name));

  const save = (next: CrewMember[]) => send({ type: 'setVehicleCrew', vehicleId: v.id, crew: sortCrew(next) });
  const add = (name: string) => {
    if (!canAdd(name)) return;
    // מי שמוגדר כמפקד צוות הוא תמיד מפקד הצוות: אם כבר יש מפקד ברכב — הוא מוחלף וחוזר לכוח האדם
    if (canCommand(name)) save([...crew.filter((m) => m.role !== 'commander'), { name, role: 'commander' }]);
    else save([...crew, { name, role: 'firefighter' }]);
  };
  const remove = (name: string) => {
    // מפקד הצוות לא יורד מהרכב — רק מוחלף במפקד צוות אחר
    if (isCommander(name)) return;
    save(crew.filter((m) => m.name !== name));
    setSel(null);
  };
  /** נהג אחד בלבד ברכב. מפקד צוות יכול לנהוג, והוא נשאר מפקד צוות */
  const setDriver = (name: string | null) =>
    save(
      crew.map((m) =>
        m.role === 'commander' ? { name: m.name, role: m.role, ...(m.name === name ? { drives: true } : {}) } : { name: m.name, role: m.name === name ? ('driver' as const) : ('firefighter' as const) },
      ),
    );
  const setRole = (opt: 'driver' | 'plain') => {
    if (!sel) return;
    const m = crew.find((x) => x.name === sel);
    if (!m) return;
    if (opt === 'driver') setDriver(sel);
    else if (m.role === 'commander') m.drives && setDriver(null);
    else save(crew.map((x) => (x.name === sel ? { name: x.name, role: 'firefighter' as const } : x)));
    setDialog(null);
  };
  const drives = (m: CrewMember) => m.role === 'driver' || !!m.drives;
  const roleLabel = (m: CrewMember) => (m.role === 'commander' && m.drives ? `${CREW_ROLE_LABEL.commander} · ${CREW_ROLE_LABEL.driver}` : CREW_ROLE_LABEL[m.role]);
  const addNew = () => {
    const n = newName.trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (!extra.includes(n)) setExtra([...extra, n]);
    if (!full && !crew.some((m) => m.name === n)) add(n);
    setNewName('');
    setDialog(null);
  };

  // ── גרירה (Pointer Events — עובד בעכבר ובמגע) ──
  /** על מה הגרירה מרחפת: מכוח האדם גוררים אל פאנל הצוות, מהצוות — אל פאנל כוח האדם */
  const hit = (kind: DragKind, name: string, x: number, y: number): Over => {
    const r = (kind === 'pool' ? crewRef : poolRef).current?.getBoundingClientRect();
    if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    return (kind === 'pool' ? canAdd(name) : !isCommander(name)) ? 'ok' : 'bad';
  };
  const begin = (g: Gesture) => {
    if (g.timer !== null) clearTimeout(g.timer);
    g.timer = null;
    g.active = true;
    pos.current = { x: g.x, y: g.y };
    if (g.touch) document.addEventListener('touchmove', blockScroll, { passive: false });
    else {
      try {
        g.el.setPointerCapture(g.id);
      } catch {
        /* המצביע כבר שוחרר */
      }
    }
    setDrag({ kind: g.kind, name: g.name, touch: g.touch, scale: g.el.getBoundingClientRect().width / (g.el.offsetWidth || 1) || 1, font: getComputedStyle(g.el).fontFamily });
    setOver(hit(g.kind, g.name, g.x, g.y));
  };
  /** סוף המחווה: drop=true — שחרור רגיל; false — ביטול (pointercancel, גלילה, אובדן המצביע) */
  const finish = (drop: boolean) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (g.timer !== null) clearTimeout(g.timer);
    if (!g.active) return;
    document.removeEventListener('touchmove', blockScroll);
    try {
      g.el.releasePointerCapture(g.id);
    } catch {
      /* לא נלכד / כבר שוחרר */
    }
    setDrag(null);
    setOver(null);
    // ה-click שמגיע אחרי שחרור הגרירה לא נחשב הקשה
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 80);
    if (drop && hit(g.kind, g.name, g.x, g.y) === 'ok') {
      if (g.kind === 'pool') add(g.name);
      else remove(g.name);
    }
  };
  // על הפריט עצמו רק pointerdown. ההמשך (תזוזה / שחרור / ביטול) נקלט ברמת החלון:
  // לפני שהגרירה התחילה אין לכידת מצביע, ותזוזה שנוחתת מחוץ לפריט לא הייתה מגיעה אליו — והגרירה לא הייתה מתחילה
  const dragProps = (kind: DragKind, name: string) => ({
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as Element).closest('.mdt-x')) return;
      if (gesture.current?.active) return; // אצבע נוספת בזמן גרירה
      finish(false);
      const g: Gesture = { id: e.pointerId, kind, name, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', el: e.currentTarget, timer: null, active: false };
      // במגע: לחיצה ארוכה מתחילה גרירה לכל כיוון; תזוזה אנכית לפני כן נשארת גלילה של הרשימה
      if (g.touch) g.timer = window.setTimeout(() => gesture.current === g && begin(g), HOLD_MS);
      gesture.current = g;
    },
  });
  const onMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    g.x = e.clientX;
    g.y = e.clientY;
    if (!g.active) {
      if (!g.touch && e.buttons === 0) return finish(false);
      const dx = g.x - g.x0;
      const dy = g.y - g.y0;
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      // במגע רק החלקה אופקית (לכיוון הפאנל השני) היא גרירה מיידית; אנכית — גלילה
      if (g.touch && Math.abs(dy) >= Math.abs(dx)) return finish(false);
      begin(g);
      return;
    }
    pos.current = { x: g.x, y: g.y };
    if (ghostRef.current && drag) ghostRef.current.style.transform = ghostTransform(g.x, g.y, drag);
    setOver(hit(g.kind, g.name, g.x, g.y));
  };
  const onUp = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    g.x = e.clientX;
    g.y = e.clientY;
    finish(true);
  };
  const onCancel = (e?: PointerEvent) => (!e || gesture.current?.id === e.pointerId) && finish(false);

  // המאזינים של החלון נרשמים פעם אחת וקוראים תמיד לגרסה העדכנית של המטפלים (מצב הצוות משתנה בין רינדורים)
  const live = useRef({ onMove, onUp, onCancel });
  useEffect(() => {
    live.current = { onMove, onUp, onCancel };
  });
  useEffect(() => {
    const move = (e: PointerEvent) => live.current.onMove(e);
    const up = (e: PointerEvent) => live.current.onUp(e);
    const cancel = (e: PointerEvent) => live.current.onCancel(e);
    const blur = () => live.current.onCancel(); // החלון איבד פוקוס באמצע גרירה
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', blur);
      const g = gesture.current;
      if (g?.timer != null) clearTimeout(g.timer);
      gesture.current = null;
      document.removeEventListener('touchmove', blockScroll);
    };
  }, []);

  const dropCls = (kind: DragKind) => (drag?.kind === kind ? ` drop-zone${over === 'ok' ? ' drop-ok' : over === 'bad' ? ' drop-bad' : ''}` : '');
  const selCmd = sel !== null && isCommander(sel);

  return (
    <div
      className="mdt-page mdt-crew"
      onClickCapture={(e) => {
        if (!suppressClick.current) return;
        e.stopPropagation();
        e.preventDefault();
      }}
      onContextMenu={(e) => (drag || gesture.current) && e.preventDefault()}
    >
      <section ref={crewRef} className={`mdt-panel crew-in${dropCls('pool')}`}>
        <div className="mdt-panel-h">צוות ברכב</div>
        <div className="mdt-scroll mdt-rows">
          {crew.map((m) => (
            <div
              key={m.name}
              className={`mdt-row crew ${sel === m.name ? 'sel' : ''}${drag?.kind === 'crew' && drag.name === m.name ? ' dragging' : ''}`}
              onClick={() => setSel(sel === m.name ? null : m.name)}
              {...dragProps('crew', m.name)}
            >
              <span className="mdt-crew-name">
                <Avatar name={m.name} size={50} />
                {m.name}
              </span>
              <span className={`mdt-crew-ic${m.role === 'commander' && m.drives ? ' two' : ''}`}>
                {m.role === 'commander' && <IcCommander size={44} />}
                {drives(m) && <IcWheel />}
              </span>
              <span className={`mdt-crew-role${m.role === 'commander' && m.drives ? ' two' : ''}`}>{roleLabel(m)}</span>
              {sel === m.name && m.role !== 'commander' && (
                <button
                  className="mdt-x"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(m.name);
                  }}
                  aria-label="הסר מהרכב"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {!crew.length && <div className="mdt-empty">אין צוות משובץ — בחרו מכוח האדם</div>}
        </div>
        <div className="mdt-crew-foot">
          <span className="dim">
            {drag?.kind === 'crew' && isCommander(drag.name) ? (
              <b className="mdt-crew-full">מפקד הצוות נשאר ברכב — להחלפה שבצו מפקד צוות אחר</b>
            ) : drag?.kind === 'pool' && !canAdd(drag.name) ? (
              <b className="mdt-crew-full">הרכב מלא — {max}/{max}</b>
            ) : (
              <>
                {crew.length}/{max} משובצים{!commander && ' · חסר מפקד צוות'}
                {v.type !== 'commander' && !crew.some(drives) && crew.length > 0 && ' · חסר נהג'}
              </>
            )}
          </span>
        </div>
      </section>

      <section ref={poolRef} className={`mdt-panel crew-pool${dropCls('crew')}`}>
        <div className="mdt-panel-h">
          כח אדם לשיבוץ
          <span className="mdt-panel-sub">גררו לשיבוץ, או הקישו</span>
        </div>
        <div className="mdt-scroll">
          <div className="mdt-people">
            {pool.map((n) => {
              const [a, b] = splitName(n);
              return (
                // לא disabled אמיתי — כדי שגם ברכב מלא אפשר יהיה לגרור ולראות שהשיבוץ נדחה
                <button
                  key={n}
                  className={`mdt-person${canAdd(n) ? '' : ' off'}${drag?.kind === 'pool' && drag.name === n ? ' dragging' : ''}`}
                  aria-disabled={!canAdd(n)}
                  onClick={() => add(n)}
                  title={!canAdd(n) ? 'הרכב מלא' : swaps(n) ? 'שבץ כמפקד הצוות במקום המפקד הנוכחי' : 'שבץ לרכב'}
                  {...dragProps('pool', n)}
                >
                  {canCommand(n) && (
                    <span className="mdt-cmd-badge" title="מוגדר כמפקד צוות">
                      <IcCommander size={20} />
                      מפק״צ
                    </span>
                  )}
                  <Avatar name={n} size={58} />
                  <span>{a}</span>
                  <span>{b}</span>
                </button>
              );
            })}
            {!pool.length && <div className="mdt-empty">כל כוח האדם משובץ</div>}
          </div>
        </div>
      </section>

      <div className="mdt-crew-btns">
        <button className="mdt-btn" disabled={!sel} onClick={() => setDialog('role')} title={sel ? '' : 'בחרו איש צוות ברשימה'}>
          הגדרת תפקיד
        </button>
        <button className="mdt-btn cyan" onClick={() => setDialog('add')}>
          הוספת כח אדם
        </button>
      </div>

      {dialog && (
        <div className="mdt-modal-wrap" onClick={() => setDialog(null)}>
          <div className="mdt-modal" onClick={(e) => e.stopPropagation()}>
            {dialog === 'role' && sel ? (
              <>
                <h3>תפקיד עבור {sel}</h3>
                <p className="dim">{selCmd ? 'מפקד הצוות נשאר מפקד צוות — אפשר להגדיר אותו גם כנהג.' : 'מפקד צוות — רק מי שמוגדר כמפקד צוות בתחנה.'}</p>
                <div className="mdt-modal-btns">
                  <button className="mdt-btn big" onClick={() => setRole('plain')}>
                    {selCmd ? CREW_ROLE_LABEL.commander : CREW_ROLE_LABEL.firefighter}
                  </button>
                  <button className="mdt-btn big" onClick={() => setRole('driver')}>
                    {selCmd ? `${CREW_ROLE_LABEL.commander} + ${CREW_ROLE_LABEL.driver}` : CREW_ROLE_LABEL.driver}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>הוספת כח אדם</h3>
                <p className="dim">איש צוות שלא מופיע ברשימה (מתנדב, מילואים, החלפה ממשמרת אחרת). יתווסף לכוח האדם של {st.name}{full ? '' : ' וישובץ לרכב'}.</p>
                <input className="mdt-input" autoFocus placeholder="שם פרטי ושם משפחה" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNew()} />
                <div className="mdt-modal-btns">
                  <button className="mdt-btn" onClick={() => setDialog(null)}>
                    ביטול
                  </button>
                  <button className="mdt-btn cyan" disabled={!newName.trim()} onClick={addNew}>
                    הוספה
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {drag &&
        createPortal(
          // ב-body ולא בתוך המסך: position: fixed לא עובד בתוך אב עם transform. המחלקה mdt מביאה את משתני הערכה
          <div ref={ghostRef} dir="rtl" className={`mdt mdt-drag-ghost${over === 'ok' ? ' ok' : over === 'bad' ? ' bad' : ''}`} style={{ transform: ghostTransform(pos.current.x, pos.current.y, drag), fontFamily: drag.font }}>
            <Avatar name={drag.name} size={46} />
            <span>{drag.name}</span>
            {canCommand(drag.name) && <IcCommander size={26} />}
          </div>,
          document.body,
        )}
    </div>
  );
}
