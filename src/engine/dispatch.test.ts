import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { distKm, mainStationId, otherTeam, recommend, requirement } from './dispatch';
import { HOSPITALS, STATIONS_GEO } from './geo';
import type { LatLng } from './model';

const geo = (id: number) => STATIONS_GEO.find((s) => s.id === id)!;
const near = (p: LatLng): LatLng => ({ lat: p.lat + 0.001, lng: p.lng + 0.001 });
const REHOVOT = near(geo(1).pos);
const YAVNE = near(geo(11).pos);

const open = (e: Engine, typeKey = 'vehicle', severity: 1 | 2 | 3 = 1, pos = REHOVOT) =>
  e.apply({ type: 'openIncident', typeKey, severity, address: 'כתובת', pos, caller: 'x', phone: 'x', notes: '' });
const lastInc = (e: Engine) => e.state.incidents[e.state.incidents.length - 1].id;
const onInc = (e: Engine, incId: string) => e.state.vehicles.filter((v) => v.incidentId === incId);
const engines = (e: Engine, incId: string) => onInc(e, incId).filter((v) => v.type === 'engine').map((v) => v.id);

describe('מבנה המחוז ומספור', () => {
  it('בכל תחנה ראשית יש בדיוק 41/475/480/490/440/406', () => {
    const e = new Engine(0);
    for (const st of e.state.stations.filter((s) => s.parentId === null)) {
      const units = e.state.vehicles.filter((v) => v.stationId === st.id).map((v) => v.unit).sort();
      expect(units).toEqual(['406', '41', '440', '475', '480', '490']);
      expect(st.teamOrder).toEqual(['א', 'ב']);
      const v = (u: string) => e.vehicle(`${st.id}-${u}`)!;
      expect(v('41')).toMatchObject({ type: 'commander', role: 'shift', homeTeam: null });
      expect(v('475')).toMatchObject({ type: 'commander', role: 'deputy', homeTeam: null });
      expect(v('480')).toMatchObject({ type: 'ladder', homeTeam: null, crewTeam: null });
      expect(v('490')).toMatchObject({ type: 'tanker', homeTeam: null, crewTeam: null });
      expect(v('440')).toMatchObject({ type: 'engine', homeTeam: 'א' });
      expect(v('406')).toMatchObject({ type: 'engine', homeTeam: 'ב' });
      expect(st.teams.א?.unit).toBe('440');
      expect(st.teams.ב?.unit).toBe('406');
    }
    expect(e.vehicle('1-440')!.callsign).toBe('440 רחובות');
    expect(e.vehicle('6-41')!.callsign).toBe('41 נתניה');
  });

  it('תחנות משנה: יבנה 402, גדרה 401, אזה״ת ראשל״צ 402', () => {
    const e = new Engine(0);
    const unitsOf = (id: number) => e.state.vehicles.filter((v) => v.stationId === id).map((v) => v.unit);
    expect(unitsOf(11)).toEqual(['402']);
    expect(unitsOf(12)).toEqual(['401']);
    expect(unitsOf(21)).toEqual(['402']);
    expect(e.vehicle('11-402')!.callsign).toBe('402 יבנה');
    for (const st of e.state.stations.filter((s) => s.parentId !== null)) {
      expect(st.teamOrder).toEqual(['א']);
      expect(e.state.vehicles.filter((v) => v.stationId === st.id)).toHaveLength(1);
      expect(e.state.vehicles.find((v) => v.stationId === st.id)).toMatchObject({ type: 'engine', homeTeam: 'א' });
    }
  });

  it('רכבי תחנת משנה משדרים בערוץ של הראשית', () => {
    const e = new Engine(0);
    expect(mainStationId(e.station(12))).toBe(1);
    open(e, 'vehicle', 1, near(geo(12).pos));
    const id = lastInc(e);
    expect(engines(e, id)).toEqual(['12-401']);
    expect(e.state.dispatches.at(-1)).toMatchObject({ stationId: 12, incidentId: id, team: 'א' });
    expect(e.state.radio.some((m) => m.channel === 'st1' && m.text.startsWith('הזנקה!') && m.text.includes('401 גדרה'))).toBe(true);
    expect(e.state.radio.some((m) => m.channel === ('st12' as never))).toBe(false);
  });
});

describe('רוטציית צוותים', () => {
  it('שריפת רכב ליד רחובות → 440, אחריו 406, ובפעם השלישית תחנה אחרת', () => {
    const e = new Engine(0);
    expect(e.station(1).turnTeam).toBe('א');
    open(e);
    expect(engines(e, lastInc(e))).toEqual(['1-440']);
    expect(e.station(1).turnTeam).toBe('ב');
    open(e);
    expect(engines(e, lastInc(e))).toEqual(['1-406']);
    expect(e.station(1).turnTeam).toBe('א');
    open(e);
    const third = onInc(e, lastInc(e));
    expect(third).toHaveLength(1);
    expect(third[0].stationId).not.toBe(1);
  });

  it('צוות שחוזר לתחנה חוזר לזמינות ונשאר בסדר התור', () => {
    const e = new Engine(0);
    open(e); // 440 יוצא, התור לב
    const eng = e.vehicle('1-440')!;
    e.apply({ type: 'vehicleAction', vehicleId: eng.id, action: 'home' });
    expect(eng.status).toBe('available');
    open(e);
    expect(engines(e, lastInc(e))).toEqual(['1-406']);
    open(e); // א חזר ובתור
    expect(engines(e, lastInc(e))).toEqual(['1-440']);
  });

  it('הצוות שבתור בחוץ → יוצא השני, והתור לא מתחלף', () => {
    const e = new Engine(0);
    open(e); // 440 יוצא, התור לב
    e.apply({ type: 'setTurnTeam', stationId: 1, team: 'א' });
    open(e);
    expect(engines(e, lastInc(e))).toEqual(['1-406']);
    expect(e.station(1).turnTeam).toBe('א');
  });

  it('תחנת משנה עם צוות אחד: שתי הזנקות, התור נשאר א', () => {
    const e = new Engine(0);
    expect(otherTeam('א', ['א'])).toBe('א');
    open(e, 'vehicle', 1, YAVNE);
    expect(engines(e, lastInc(e))).toEqual(['11-402']);
    expect(e.station(11).turnTeam).toBe('א');
    e.apply({ type: 'vehicleAction', vehicleId: '11-402', action: 'home' });
    open(e, 'vehicle', 1, YAVNE);
    expect(engines(e, lastInc(e))).toEqual(['11-402']);
    expect(e.station(11).turnTeam).toBe('א');
    // צוות שלא קיים בתחנה — לא נקלט
    e.apply({ type: 'setTurnTeam', stationId: 11, team: 'ב' });
    expect(e.station(11).turnTeam).toBe('א');
  });
});

describe('יחידות עצמאיות ומפקדים', () => {
  it('שריפת מבנה: מנוף 480 ומפקד 475 (לא 41); 480 לא משנה את התור', () => {
    const e = new Engine(0);
    const rec = recommend(e.state, REHOVOT, requirement('structure', 1), 1);
    const ids = rec.assignments.map((a) => a.vehicleId);
    expect(ids).toContain('1-480');
    expect(ids).toContain('1-475');
    expect(ids).not.toContain('1-41');
    expect(rec.assignments.find((a) => a.vehicleId === '1-480')!.team).toBeNull();
    expect(rec.shortage).toEqual({});
    // סבב ראשון — צוות אחד לתחנה
    const engs = rec.assignments.filter((a) => e.vehicle(a.vehicleId)!.type === 'engine');
    expect(engs).toHaveLength(2);
    expect(new Set(engs.map((a) => a.stationId)).size).toBe(2);

    open(e, 'structure');
    expect(e.vehicle('1-480')!.crewTeam).toBeNull();
    expect(e.station(1).turnTeam).toBe('ב'); // רק 440 הזיז את התור

    // הזנקה ידנית של 480 בלבד — התור לא זז
    const e3 = new Engine(0);
    e3.apply({ type: 'setAutoDispatch', value: false });
    open(e3);
    e3.apply({ type: 'dispatchUnits', incidentId: lastInc(e3), vehicleIds: ['1-480'] });
    expect(e3.vehicle('1-480')!.status).toBe('dispatched');
    expect(e3.vehicle('1-480')!.crewTeam).toBeNull();
    expect(e3.station(1).turnTeam).toBe('א');
    // 480 בחוץ לא תופס צוות — 440 עדיין יוצא
    e3.apply({ type: 'setAutoDispatch', value: true });
    open(e3);
    expect(engines(e3, lastInc(e3))).toEqual(['1-440']);
  });

  it('דרישת מפקד בלי 475 זמין → 41', () => {
    const e = new Engine(0);
    for (const v of e.state.vehicles.filter((v) => v.role === 'deputy')) v.status = 'offline';
    const rec = recommend(e.state, REHOVOT, { commander: 1 }, 1);
    expect(rec.assignments.map((a) => a.vehicleId)).toEqual(['1-41']);
  });

  it('חומרה 3 מוסיפה 41', () => {
    const e = new Engine(0);
    const ids1 = recommend(e.state, REHOVOT, requirement('structure', 1), 1).assignments.map((a) => a.vehicleId);
    expect(ids1).not.toContain('1-41');
    open(e, 'structure', 3);
    const ids3 = onInc(e, lastInc(e)).map((v) => v.id);
    expect(ids3).toContain('1-41');
    expect(ids3).toContain('1-475');
    // תגבור באירוע חומרה 3 לא מוסיף מפקד משמרת נוסף
    e.apply({ type: 'reinforce', incidentId: lastInc(e), unitType: 'engine' });
    expect(onInc(e, lastInc(e)).filter((v) => v.role === 'shift')).toHaveLength(1);
  });
});

describe('מד״א', () => {
  it('תאונה עם לכודים: האמבולנס מפנה לבית החולים הקרוב ומגיע אליו', () => {
    const e = new Engine(0);
    open(e, 'mva');
    const id = lastInc(e);
    const inc = e.state.incidents.find((i) => i.id === id)!;
    const nearest = [...HOSPITALS].sort((a, b) => distKm(a.pos, inc.pos) - distKm(b.pos, inc.pos))[0];
    let arrived: LatLng | null = null;
    for (let i = 0; i < 6000 && !arrived; i++) {
      const before = e.state.ambulances.find((a) => a.incidentId === id)?.status;
      e.tick(1000);
      const amb = e.state.ambulances.find((a) => a.incidentId === id);
      if (amb && before === 'transporting' && amb.status === 'returning') arrived = { ...amb.pos };
    }
    expect(arrived).toEqual(nearest.pos);
    expect(e.state.radio.some((m) => m.channel === 'mda' && m.text.includes(`מפנה פצוע ל${nearest.name}`))).toBe(true);
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
