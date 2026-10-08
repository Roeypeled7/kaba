import { useEffect, useMemo, useRef, useState } from 'react';
import { INCIDENT_TYPE } from '../engine/config';
import type { ChannelId, Command, SimState } from '../engine/model';
import { AmbChip, IncidentTitle, TopBar, byUnit, fmtTime, mainStations, stationGroupIds, stationShort } from '../components/ui';
import { playBlip } from '../sound';

type Send = (c: Command) => void;
type View = ChannelId | 'all';

const QUICK = ['דווח מצב', 'עדכן זמן הגעה', 'האם נדרש תגבור?', 'קיבלתי', 'המתינו להנחיות', 'עדכנו בסיום'];

export default function Comms({ state, send }: { state: SimState; send: Send }) {
  const channels = useMemo(
    () =>
      [
        { id: 'district' as ChannelId, name: 'מבצעי מחוזי' },
        ...mainStations(state.stations).map((s) => ({ id: `st${s.id}` as ChannelId, name: `תחנה — ${stationShort(s)}` })),
        { id: 'mda' as ChannelId, name: 'מד״א' },
        { id: 'police' as ChannelId, name: 'משטרה' },
      ] as { id: ChannelId; name: string }[],
    [state.stations],
  );
  const [view, setView] = useState<View>('all');
  const [incFilter, setIncFilter] = useState('');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [tx, setTx] = useState(false);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const logRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(state.radio[state.radio.length - 1]?.id ?? 0);

  // צליל על הודעה נכנסת
  useEffect(() => {
    const fresh = state.radio.filter((m) => m.id > lastId.current);
    if (fresh.some((m) => !m.outgoing)) playBlip();
    lastId.current = state.radio[state.radio.length - 1]?.id ?? lastId.current;
  }, [state.radio]);

  const msgs = state.radio.filter((m) => (view === 'all' || m.channel === view) && (!incFilter || m.incidentId === incFilter));
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [msgs.length, view, incFilter]);

  useEffect(() => {
    const top = state.radio[state.radio.length - 1]?.id ?? 0;
    setSeen((s) => ({ ...s, [view]: top }));
  }, [view, state.radio]);

  const txChannel: ChannelId = view === 'all' ? 'district' : view;
  const targets = useMemo(() => {
    if (txChannel === 'mda') return ['מד״א'];
    if (txChannel === 'police') return ['מוקד משטרה'];
    const mains = mainStations(state.stations);
    if (txChannel === 'district') {
      const cmd = (unit: string) => mains.flatMap((st) => state.vehicles.filter((v) => v.stationId === st.id && v.unit === unit).map((v) => v.callsign));
      return ['כל התחנות', ...cmd('41'), ...cmd('475'), ...mains.map((s) => s.name)];
    }
    const sid = Number(txChannel.slice(2));
    const group = [...stationGroupIds(state.stations, sid)];
    const names = group.map((id) => state.stations.find((s) => s.id === id)?.name).filter((n): n is string => !!n);
    const units = group.flatMap((id) => state.vehicles.filter((v) => v.stationId === id).sort(byUnit).map((v) => v.callsign));
    return [...names, ...units];
  }, [txChannel, state.vehicles, state.stations]);
  const target = targets.includes(to) ? to : targets[0];

  const transmit = (t = text) => {
    if (!t.trim()) return;
    send({ type: 'sendRadio', channel: txChannel, to: target, text: t.trim(), incidentId: incFilter || undefined });
    setText('');
  };

  const now = state.simTime;
  const active = state.incidents.filter((i) => i.status !== 'closed');

  return (
    <div className="screen comms">
      <TopBar state={state} title="מערכת קשר" accent="#4cc9f0" />
      <div className="comms-grid">
        <aside className="panel channels">
          <h2>ערוצים</h2>
          {[{ id: 'all' as View, name: 'כל הערוצים' }, ...channels].map((c) => {
            const last = [...state.radio].reverse().find((m) => c.id === 'all' || m.channel === c.id);
            const live = last && !last.outgoing && now - last.t < 6000 * state.speed;
            const unread = state.radio.filter((m) => (c.id === 'all' || m.channel === c.id) && m.id > (seen[c.id] ?? 0) && !m.outgoing).length;
            return (
              <button key={c.id} className={`channel ${view === c.id ? 'on' : ''}`} onClick={() => setView(c.id)}>
                <span className={`led ${live ? 'live' : ''}`} />
                <span className="grow">{c.name}</span>
                {unread > 0 && view !== c.id && <span className="count">{unread}</span>}
              </button>
            );
          })}
          <h2>סינון לפי אירוע</h2>
          <select value={incFilter} onChange={(e) => setIncFilter(e.target.value)}>
            <option value="">כל האירועים</option>
            {state.incidents
              .slice()
              .reverse()
              .map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.id} {INCIDENT_TYPE[i.typeKey].label}
                </option>
              ))}
          </select>
        </aside>

        <section className="panel radio-log">
          <div className="log" ref={logRef}>
            {msgs.map((m) => (
              <div key={m.id} className={`msg ${m.outgoing ? 'out' : 'in'} ch-${m.channel.startsWith('st') ? 'st' : m.channel}`}>
                <div className="msg-meta">
                  <span className="mono">{fmtTime(m.t)}</span>
                  <span className="ch-tag">{channels.find((c) => c.id === m.channel)?.name}</span>
                  <b>{m.from}</b> ← <span>{m.to}</span>
                  {m.incidentId && (
                    <button className="inc-link" onClick={() => setIncFilter(m.incidentId!)}>
                      #{m.incidentId}
                    </button>
                  )}
                </div>
                <div className="msg-text">{m.text}</div>
              </div>
            ))}
          </div>
          <div className={`composer ${tx ? 'tx' : ''}`}>
            <div className="row gap">
              <span className="lbl">ערוץ: {channels.find((c) => c.id === txChannel)?.name}</span>
              <span className="lbl">אל:</span>
              <select value={target} onChange={(e) => setTo(e.target.value)}>
                {targets.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              {incFilter && <span className="chip">בהקשר אירוע #{incFilter}</span>}
            </div>
            <div className="quick">
              {QUICK.map((q) => (
                <button key={q} className="btn xs" onClick={() => transmit(q)}>
                  {q}
                </button>
              ))}
            </div>
            <div className="row gap">
              <input className="grow" placeholder="הודעה… (Enter לשליחה)" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && transmit()} />
              <button
                className={`ptt ${tx ? 'on' : ''}`}
                onPointerDown={() => setTx(true)}
                onPointerUp={() => {
                  setTx(false);
                  transmit();
                }}
                onPointerLeave={() => setTx(false)}
              >
                {tx ? '● משדר' : 'PTT'}
              </button>
            </div>
          </div>
        </section>

        <aside className="panel comms-side">
          <h2>אירועים פעילים</h2>
          {!active.length && <div className="empty">אין</div>}
          {active.map((inc) => (
            <div key={inc.id} className="side-inc">
              <IncidentTitle inc={inc} />
              <div className="dim small">{inc.address}</div>
              <div className="row gap">
                <button className="btn xs" onClick={() => send({ type: 'requestAmbulance', incidentId: inc.id })}>
                  ✚ בקש אמבולנס
                </button>
                <button className="btn xs" disabled={inc.policeNotified} onClick={() => send({ type: 'notifyPolice', incidentId: inc.id })}>
                  🚓 משטרה
                </button>
                <button className="btn xs ghost" onClick={() => setIncFilter(inc.id)}>
                  הצג תעבורה
                </button>
              </div>
            </div>
          ))}
          <h2>מד״א — סטטוס</h2>
          {state.ambulances.map((a) => (
            <div key={a.id} className="ub-row">
              <span className="callsign">{a.callsign}</span>
              <span className="push" />
              {a.incidentId && <span className="mono dim small">#{a.incidentId}</span>}
              <AmbChip a={a} />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
