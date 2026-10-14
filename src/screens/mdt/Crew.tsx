import { useState } from 'react';
import { CREW_ROLE_LABEL } from '../../engine/config';
import type { CrewMember, CrewRole } from '../../engine/model';
import { IcCommander, IcWheel } from './icons';
import { Avatar, splitName, stationPeople, useLocal, type Ctx } from './shared';

const ROLE_RANK: Record<CrewRole, number> = { commander: 0, driver: 1, firefighter: 2 };
const sortCrew = (c: CrewMember[]) => [...c].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]);

export default function Crew({ state, send, v, st }: Ctx) {
  const [extra, setExtra] = useLocal<string[]>(`kaba.mdt.extra.${st.id}`, () => []);
  const [sel, setSel] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'role' | 'add' | null>(null);
  const [newName, setNewName] = useState('');
  const max = v.type === 'commander' ? 2 : v.type === 'engine' ? 6 : 3;

  const assigned = new Set(state.vehicles.filter((x) => x.stationId === st.id).flatMap((x) => x.crew.map((m) => m.name)));
  const pool = stationPeople(state, st, extra).filter((n) => !assigned.has(n));
  const crew = sortCrew(v.crew);
  const full = crew.length >= max;

  const save = (next: CrewMember[]) => send({ type: 'setVehicleCrew', vehicleId: v.id, crew: sortCrew(next) });
  const add = (name: string) => !full && save([...crew, { name, role: crew.length ? 'firefighter' : 'commander' }]);
  const remove = (name: string) => {
    save(crew.filter((m) => m.name !== name));
    setSel(null);
  };
  const setRole = (role: CrewRole) => {
    if (!sel) return;
    // מפקד ונהג — אחד בלבד; מי שהחזיק בתפקיד הופך ללוחם אש
    save(crew.map((m) => (m.name === sel ? { ...m, role } : role !== 'firefighter' && m.role === role ? { ...m, role: 'firefighter' as const } : m)));
    setDialog(null);
  };
  const addNew = () => {
    const n = newName.trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (!extra.includes(n)) setExtra([...extra, n]);
    if (!full && !crew.some((m) => m.name === n)) add(n);
    setNewName('');
    setDialog(null);
  };

  return (
    <div className="mdt-page mdt-crew">
      <section className="mdt-panel crew-in">
        <div className="mdt-panel-h">צוות ברכב</div>
        <div className="mdt-scroll mdt-rows">
          {crew.map((m) => (
            <div key={m.name} className={`mdt-row crew ${sel === m.name ? 'sel' : ''}`} onClick={() => setSel(sel === m.name ? null : m.name)}>
              <span className="mdt-crew-name">
                <Avatar name={m.name} size={50} />
                {m.name}
              </span>
              <span className="mdt-crew-ic">{m.role === 'commander' ? <IcCommander size={44} /> : m.role === 'driver' ? <IcWheel /> : null}</span>
              <span className="mdt-crew-role">{CREW_ROLE_LABEL[m.role]}</span>
              {sel === m.name && (
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
            {crew.length}/{max} משובצים{!crew.some((m) => m.role === 'commander') && crew.length > 0 && ' · חסר מפקד צוות'}
            {v.type !== 'commander' && !crew.some((m) => m.role === 'driver') && crew.length > 0 && ' · חסר נהג'}
          </span>
        </div>
      </section>

      <section className="mdt-panel crew-pool">
        <div className="mdt-panel-h">כח אדם לשיבוץ</div>
        <div className="mdt-scroll">
          <div className="mdt-people">
            {pool.map((n) => {
              const [a, b] = splitName(n);
              return (
                <button key={n} className="mdt-person" disabled={full} onClick={() => add(n)} title={full ? 'הרכב מלא' : 'שבץ לרכב'}>
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
          הגדרת מפק״צ/נהג
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
                <div className="mdt-modal-btns">
                  {(Object.keys(CREW_ROLE_LABEL) as CrewRole[]).map((r) => (
                    <button key={r} className="mdt-btn big" onClick={() => setRole(r)}>
                      {CREW_ROLE_LABEL[r]}
                    </button>
                  ))}
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
    </div>
  );
}
