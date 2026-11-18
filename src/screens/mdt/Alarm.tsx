import { useEffect, useRef } from 'react';
import { INCIDENT_TYPE } from '../../engine/config';
import { siteLine } from '../../components/ui';
import type { Ctx } from './shared';
import './alarm.css';

/** חלון ההזנקה — כרטיס במרכז מסך הטאבלט, מעל המסך המפוצל. נסגר רק ביציאה (כפתור יציאה / ✕ / Escape) */
export default function AlarmOverlay({ ctx, dispatchIds }: { ctx: Ctx; dispatchIds: string[] }) {
  const { state, send, v } = ctx;
  const inc = state.incidents.find((i) => i.id === v.incidentId);
  const t = inc ? INCIDENT_TYPE[inc.typeKey] : undefined;
  const units = inc ? state.vehicles.filter((x) => x.incidentId === inc.id) : [];
  // היציאה מאשרת את ההזנקה מול המוקד, וזה מה שסוגר את החלון — אין מצב מקומי נפרד
  const ack = () => dispatchIds.forEach((id) => send({ type: 'ackDispatch', dispatchId: id }));

  // Escape = יציאה. ה-ref שומר על ack עדכני בלי לרשום את המאזין מחדש בכל רינדור
  const ackRef = useRef(ack);
  ackRef.current = ack;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const notes = inc?.notes.trim();

  // לחיצה על הרקע המעומעם לא סוגרת — רק הכפתורים
  return (
    <div className="mdt-alert-scrim">
      <div className="mdt-alert" role="alertdialog" aria-modal="true" aria-labelledby="mdt-alert-title">
        <header className="mdt-alert-head">
          <div className="mdt-alert-word" id="mdt-alert-title">
            הזנקה
          </div>
          <button type="button" className="mdt-alert-x" aria-label="יציאה" onClick={ack}>
            ✕
          </button>
        </header>

        <div className="mdt-alert-body">
          {inc && t ? (
            <>
              <div className="mdt-alert-type">
                <span className="mdt-alert-icon">{t.icon}</span>
                <span className="mdt-alert-label">{t.label}</span>
                <span className={`mdt-sev s${inc.severity}`}>חומרה {inc.severity}</span>
              </div>
              <div className="mdt-alert-addr">📍 {inc.address}</div>
              {siteLine(inc.site) && <div className="mdt-alert-site">{siteLine(inc.site)}</div>}
              {notes && (
                <div className="mdt-alert-notes">
                  <span className="mdt-alert-cap">פרטי המודיע</span>
                  <p>{notes}</p>
                </div>
              )}
              {units.length > 0 && (
                <div className="mdt-alert-row">
                  <span className="mdt-alert-cap">כוחות שהוזנקו</span>
                  <div className="mdt-alert-units">
                    {units.map((x) => (
                      <span key={x.id} className={x.id === v.id ? 'me' : ''}>
                        {x.callsign}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mdt-alert-fallback">הוזנקתם — פרטי האירוע מתעדכנים</div>
          )}
        </div>

        <footer className="mdt-alert-foot">
          <button type="button" className="mdt-btn huge fire mdt-alert-ack" onClick={ack} autoFocus>
            יציאה
          </button>
        </footer>
      </div>
    </div>
  );
}
