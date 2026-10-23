/* יומן מערכת ולוח משמרת — מי מחובר, מי בהפסקה, וכל פעולה שבוצעה במערכת */
import { useMemo, useState } from 'react';
import { BREAK_REASON, DESK_LABEL } from '../engine/config';
import { useAudit } from '../engine/client';
import { fmtDuration } from '../engine/engine';
import type { AuditEntry, AuditKind, DeskId, SimState } from '../engine/model';
import { TopBar, fmtTime } from '../components/ui';
import { breakOver, useNow, useSessionCtx } from '../components/session';

const KIND_LABEL: Record<AuditKind, string> = { session: 'משמרת', action: 'פעולה', system: 'מערכת', blocked: 'נחסם' };
const KINDS = Object.keys(KIND_LABEL) as AuditKind[];
const PAGE = 300;

const fmtDate = (t: number) => new Date(t).toLocaleString('he-IL', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function download(name: string, body: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCsv(rows: AuditEntry[]) {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['זמן', 'זמן הדמיה', 'סוג', 'פעולה', 'מבצע', 'מספר אישי', 'עמדה', 'רכב', 'אירוע', 'תיאור'];
  const lines = rows.map((e) =>
    [fmtDate(e.at), fmtTime(e.t), KIND_LABEL[e.kind], e.action, e.who, e.badge, e.desk ? DESK_LABEL[e.desk] : '', e.vehicleId, e.incidentId, e.text].map(q).join(','),
  );
  // BOM — כדי שאקסל יפתח עברית נכון
  download(`kaba-log-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`, '﻿' + [head.map(q).join(','), ...lines].join('\r\n'), 'text/csv;charset=utf-8');
}

export default function Log({ state }: { state: SimState }) {
  const session = useSessionCtx();
  const audit = useAudit();
  const now = useNow();
  const [kind, setKind] = useState<AuditKind | ''>('');
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const people = useMemo(() => [...new Set(audit.map((e) => e.who))].sort(), [audit]);
  const rows = useMemo(() => {
    const needle = q.trim();
    return audit
      .filter((e) => (!kind || e.kind === kind) && (!who || e.who === who) && (!needle || e.text.includes(needle) || e.incidentId === needle))
      .reverse();
  }, [audit, kind, who, q]);

  const ops = state.operators;
  const desks = (Object.keys(DESK_LABEL) as DeskId[]).map((d) => {
    const at = ops.filter((o) => o.desk === d);
    return { d, total: at.length, active: at.filter((o) => !o.onBreak).length };
  });

  return (
    <div className="screen log-screen">
      <TopBar state={state} title="יומן מערכת" accent="#b388ff" />
      <main className="log-main">
        <section className="panel">
          <h2>
            לוח משמרת <span className="count">{ops.length}</span>
            <span className="log-desks">
              {desks.map(({ d, total, active }) => (
                <span key={d} className={`log-desk ${total && !active ? 'empty' : ''}`}>
                  {DESK_LABEL[d]}: <b>{active}</b>/{total} בעמדה
                </span>
              ))}
            </span>
          </h2>
          {ops.length === 0 ? (
            <div className="empty">אין מוקדנים מחוברים</div>
          ) : (
            <table className="log-table">
              <thead>
                <tr>
                  <th>מוקדן</th>
                  <th>עמדה</th>
                  <th>סטטוס</th>
                  <th>כניסה</th>
                  <th>משמרת</th>
                  <th>הפסקות</th>
                  <th>חלונות</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ops.map((o) => {
                  const windows = Object.keys(o.windows).length;
                  const breakNow = o.onBreak ? now - o.statusSince : 0;
                  return (
                    <tr key={o.badge} className={breakOver(o, now) ? 'over' : ''}>
                      <td>
                        <b>{o.name}</b> <span className="mono dim">{o.badge}</span>
                        {o.badge === session?.me?.badge && <span className="chip">אני</span>}
                      </td>
                      <td>{DESK_LABEL[o.desk]}</td>
                      <td>
                        {o.onBreak ? (
                          <span className="op-status brk">
                            {BREAK_REASON[o.onBreak].icon} {BREAK_REASON[o.onBreak].label} · <span className="mono">{fmtDuration(breakNow)}</span>
                          </span>
                        ) : (
                          <span className="op-status on">בעמדה</span>
                        )}
                      </td>
                      <td className="mono">{fmtDate(o.loginAt)}</td>
                      <td className="mono">{fmtDuration(now - o.loginAt)}</td>
                      <td>
                        {o.breaks + (o.onBreak ? 1 : 0)} · <span className="mono">{fmtDuration(o.breakMs + breakNow)}</span>
                      </td>
                      <td>{windows || <span className="op-status brk">לא מגיב</span>}</td>
                      <td className="log-acts">
                        {o.badge !== session?.me?.badge && (
                          <>
                            {o.onBreak && (
                              <button className="btn xs" onClick={() => session?.setBreak(null, o.badge)}>
                                החזר לעמדה
                              </button>
                            )}
                            <button className="btn danger xs" onClick={() => confirm(`לנתק את ${o.name} מהמערכת?`) && session?.logout(o.badge)}>
                              ניתוק
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel log-audit">
          <h2>
            יומן פעולות <span className="count">{rows.length}</span>
            <span className="dim small">נרשם אוטומטית ונשמר בדפדפן — שורד רענון, סגירת חלונות ואיפוס הדמיה</span>
          </h2>
          <div className="row gap log-filters">
            <div className="seg xs">
              <button className={!kind ? 'on' : ''} onClick={() => setKind('')}>
                הכל
              </button>
              {KINDS.map((k) => (
                <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">כל המבצעים</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input placeholder="חיפוש בטקסט / מספר אירוע" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn sm" onClick={() => exportCsv(rows.slice().reverse())} disabled={!rows.length}>
              ⬇ CSV
            </button>
            <button className="btn sm" onClick={() => download('kaba-log.json', JSON.stringify(rows.slice().reverse(), null, 2), 'application/json')} disabled={!rows.length}>
              ⬇ JSON
            </button>
          </div>
          <table className="log-table log-entries">
            <thead>
              <tr>
                <th>זמן</th>
                <th>הדמיה</th>
                <th>סוג</th>
                <th>מבצע</th>
                <th>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((e) => (
                <tr key={e.id} className={`k-${e.kind}`}>
                  <td className="mono">{fmtDate(e.at)}</td>
                  <td className="mono dim">{fmtTime(e.t)}</td>
                  <td>
                    <span className={`chip log-kind k-${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                  </td>
                  <td className="log-who">{e.who}</td>
                  <td>
                    {e.incidentId && <span className="mono dim">#{e.incidentId} </span>}
                    {e.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty">אין רשומות</div>}
          {rows.length > limit && (
            <button className="btn ghost sm" onClick={() => setLimit(limit + PAGE)}>
              הצג עוד ({rows.length - limit})
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
