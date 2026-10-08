import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { recommend, requirement } from './dispatch';

const KFAR_SABA = { lat: 32.1772, lng: 34.9058 };
const open = (e: Engine, typeKey = 'vehicle', severity: 1 | 2 | 3 = 1) =>
  e.apply({ type: 'openIncident', typeKey, severity, address: 'כפר סבא, ויצמן 120', pos: KFAR_SABA, caller: 'x', phone: 'x', notes: '' });

const engineCrew = (e: Engine, incId: string) =>
  e.state.vehicles.filter((v) => v.incidentId === incId && v.type === 'engine').map((v) => `${v.stationId}${v.crewTeam}`);

describe('רוטציית צוותים', () => {
  it('שתי הזנקות רצופות לתחנה 1 → צוות א ואז צוות ב', () => {
    const e = new Engine(0);
    expect(e.station(1).turnTeam).toBe('א');
    open(e);
    expect(engineCrew(e, '1001')).toEqual(['1א']);
    expect(e.station(1).turnTeam).toBe('ב');
    open(e);
    expect(engineCrew(e, '1002')).toEqual(['1ב']);
    expect(e.station(1).turnTeam).toBe('א');
  });

  it('כששני הצוותים בחוץ — מוזנקת התחנה הבאה', () => {
    const e = new Engine(0);
    open(e);
    open(e);
    open(e);
    const crew = engineCrew(e, '1003');
    expect(crew).toHaveLength(1);
    expect(crew[0].startsWith('1')).toBe(false);
  });

  it('צוות שחוזר לתחנה חוזר לזמינות ונשאר בסדר התור', () => {
    const e = new Engine(0);
    open(e); // א יוצא, התור לב
    const eng = e.state.vehicles.find((v) => v.incidentId === '1001')!;
    e.apply({ type: 'vehicleAction', vehicleId: eng.id, action: 'home' });
    expect(eng.status).toBe('available');
    open(e); // ב יוצא
    expect(engineCrew(e, '1002')).toEqual(['1ב']);
    open(e); // א חזר ובתור
    expect(engineCrew(e, '1003')).toEqual(['1א']);
  });

  it('הצוות שבתור בחוץ → יוצא השני, והתור לא מתחלף', () => {
    const e = new Engine(0);
    open(e); // א יוצא, התור לב
    e.apply({ type: 'setTurnTeam', stationId: 1, team: 'א' }); // מחזירים ידנית את התור לצוות שבחוץ
    open(e);
    expect(engineCrew(e, '1002')).toEqual(['1ב']);
    expect(e.station(1).turnTeam).toBe('א');
  });

  it('שריפת מבנה מפזרת צוות אחד לתחנה בסבב הראשון', () => {
    const e = new Engine(0);
    const rec = recommend(e.state, KFAR_SABA, requirement('structure', 1), 1);
    const engines = rec.assignments.filter((a) => a.vehicleId.startsWith('E'));
    expect(new Set(engines.map((a) => a.stationId)).size).toBe(2);
    expect(rec.assignments.some((a) => a.vehicleId.startsWith('C'))).toBe(true);
    expect(rec.shortage).toEqual({});
  });
});

describe('מחזור חיים של אירוע', () => {
  it('הזנקה → זירה → נשלט → כולם חוזרים → האירוע נסגר', () => {
    const e = new Engine(0);
    open(e);
    const inc = e.state.incidents[0];
    for (let i = 0; i < 4000 && inc.status !== 'closed'; i++) e.tick(1000);
    expect(inc.status).toBe('closed');
    for (let i = 0; i < 2000 && e.state.vehicles.some((v) => v.status !== 'available'); i++) e.tick(1000);
    expect(e.state.vehicles.every((v) => v.status === 'available')).toBe(true);
  });
});
