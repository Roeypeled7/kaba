import { useState } from 'react';
import { CREW_ROLE_LABEL } from '../../engine/config';
import { fmtHM, stationShort } from '../../components/ui';
import { IcRadio } from './icons';
import { Avatar, unitFeed, useLocal, type Ctx } from './shared';

interface Device {
  id: string;
  serial: string;
  battery: number;
}

/** מכשירים ניידים של הרכב — קבועים לכל רכב */
function devicesFor(vehicleId: string, unit: string): Device[] {
  let s = [...vehicleId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 6 }, (_, i) => ({
    id: `${unit}-${i + 1}`,
    serial: `MTP-${Math.floor(1000 + r() * 9000)}`,
    battery: Math.round(35 + r() * 65),
  }));
}

export default function Radios({ state, send, v, st }: Ctx) {
  const devices = devicesFor(v.id, v.unit);
  const [pairs, setPairs] = useLocal<Record<string, string>>(`kaba.mdt.radios.${v.id}`, () => ({}));
  const [sel, setSel] = useState<string | null>(v.crew[0]?.name ?? null);
  const holder = (id: string) => Object.keys(pairs).find((n) => pairs[n] === id);
  const crewNames = v.crew.map((m) => m.name);
  // צימוד של מי שכבר לא ברכב לא נספר
  const live = Object.fromEntries(Object.entries(pairs).filter(([n]) => crewNames.includes(n)));

  const pair = (devId: string) => {
    if (!sel) return;
    const next = { ...live };
    for (const n of Object.keys(next)) if (next[n] === devId) delete next[n];
    next[sel] = devId;
    setPairs(next);
    const i = crewNames.indexOf(sel);
    const nextUnpaired = crewNames.find((n, j) => j > i && !next[n]);
    setSel(nextUnpaired ?? null);
  };
  const auto = () => {
    const free = devices.filter((d) => !Object.values(live).includes(d.id)).sort((a, b) => b.battery - a.battery);
    const next = { ...live };
    for (const n of crewNames) if (!next[n] && free.length) next[n] = free.shift()!.id;
    setPairs(next);
  };
  const feed = unitFeed(state, v, 4);

  return (
    <div className="mdt-page mdt-radios">
      <section className="mdt-panel crew-in">
        <div className="mdt-panel-h">צוות ומכשירים</div>
        <div className="mdt-scroll mdt-rows">
          {v.crew.map((m) => {
            const d = devices.find((x) => x.id === live[m.name]);
            return (
              <div key={m.name} className={`mdt-row crew ${sel === m.name ? 'sel' : ''}`} onClick={() => setSel(m.name)}>
                <span className="mdt-crew-name">
                  <Avatar name={m.name} size={44} />
                  <span>
                    {m.name}
                    <span className="mdt-row-sub">{CREW_ROLE_LABEL[m.role]}</span>
                  </span>
                </span>
                <span className={`mdt-pair ${d ? 'on' : ''}`}>{d ? `📻 ${d.id}` : 'לא צומד'}</span>
                {d && (
                  <button
                    className="mdt-x"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = { ...live };
                      delete next[m.name];
                      setPairs(next);
                    }}
                    aria-label="ניתוק"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          {!v.crew.length && <div className="mdt-empty">אין צוות ברכב — שבצו צוות קודם</div>}
        </div>
        <div className="mdt-vradio">
          <span className="mdt-vradio-ic">
            <IcRadio size={34} />
          </span>
          <span className="grow">
            <b>מכשיר רכב</b>
            <span className="mdt-row-sub">ערוץ {stationShort(st)} · מחובר</span>
          </span>
          <button className="mdt-btn sm" onClick={() => send({ type: 'unitRadio', vehicleId: v.id, text: 'בדיקת קשר' })}>
            בדיקת קשר
          </button>
        </div>
        <div className="mdt-feed mini">
          {feed.map((m) => (
            <div key={m.id}>
              <span className="mono dim">{fmtHM(m.t)}</span> <b>{m.from}</b>: {m.text}
            </div>
          ))}
        </div>
      </section>

      <section className="mdt-panel crew-pool">
        <div className="mdt-panel-h">מכשירים ניידים {sel && <span className="mdt-panel-sub">בחרו מכשיר עבור {sel}</span>}</div>
        <div className="mdt-scroll">
          <div className="mdt-people devices">
            {devices.map((d) => {
              const h = holder(d.id);
              const owner = h && crewNames.includes(h) ? h : undefined;
              return (
                <button key={d.id} className={`mdt-person dev ${owner ? 'taken' : ''}`} disabled={!sel} onClick={() => pair(d.id)}>
                  <IcRadio size={44} />
                  <b className="mono">{d.id}</b>
                  <span className="mono small">{d.serial}</span>
                  <span className={`mdt-batt ${d.battery < 50 ? 'low' : ''}`}>
                    <i style={{ width: `${d.battery}%` }} />
                    <em className="mono">{d.battery}%</em>
                  </span>
                  <span className="small">{owner ?? 'פנוי'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mdt-crew-btns">
        <button className="mdt-btn" onClick={() => setPairs({})}>
          ניתוק הכל
        </button>
        <button className="mdt-btn cyan" onClick={auto}>
          צימוד אוטומטי
        </button>
      </div>
    </div>
  );
}
