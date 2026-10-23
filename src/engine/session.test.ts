import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { SESSION_TIMING } from './config';
import type { AuditEntry } from './model';

function setup() {
  const e = new Engine(0);
  let now = 1_000_000;
  e.clock = () => now;
  const log: AuditEntry[] = [];
  e.onAudit((x) => log.push(x));
  const advance = (ms: number) => {
    now += ms;
    e.tick(0);
  };
  return { e, log, advance };
}

describe('מוקדנים ויומן מערכת', () => {
  it('כניסה, הפסקה וחזרה — נרשמות ביומן עם משך', () => {
    const { e, log, advance } = setup();
    e.apply({ type: 'login', badge: '1234', name: 'רועי', desk: '102', windowId: 'w1' });
    expect(e.state.operators).toHaveLength(1);
    e.apply({ type: 'setBreak', badge: '1234', reason: 'meal' }, { badge: '1234' });
    // החלון ממשיך לשלוח פעימות גם בהפסקה
    for (let i = 0; i < 31; i++) {
      advance(60_000);
      e.apply({ type: 'heartbeat', badge: '1234', windowId: 'w1' });
    }
    e.apply({ type: 'setBreak', badge: '1234', reason: null }, { badge: '1234' });
    const op = e.state.operators[0];
    expect(op).toMatchObject({ onBreak: null, breaks: 1, breakMs: 31 * 60_000 });
    expect(log.map((x) => x.action)).toEqual(['login', 'break', 'back']);
    expect(log[2].text).toContain('חריגה');
  });

  it('פעולה ממוקדן בהפסקה לא מבוצעת ונרשמת כנחסמת', () => {
    const { e, log } = setup();
    e.apply({ type: 'login', badge: '1234', name: 'רועי', desk: '102', windowId: 'w1' });
    e.apply({ type: 'setBreak', badge: '1234', reason: 'rest' });
    e.apply({ type: 'setPaused', value: true }, { badge: '1234' });
    expect(e.state.paused).toBe(false);
    expect(log.at(-1)).toMatchObject({ kind: 'blocked', action: 'setPaused', badge: '1234' });
  });

  it('פעולה רגילה נרשמת בשם המוקדן, כולל הכוחות שהוזנקו', () => {
    const { e, log } = setup();
    e.apply({ type: 'login', badge: '1234', name: 'רועי', desk: '102', windowId: 'w1' });
    const pos = e.state.stations[0].pos;
    e.apply({ type: 'openIncident', typeKey: 'vehicle', severity: 1, address: 'הרצל 1', pos, caller: 'x', phone: 'x', notes: '' }, { badge: '1234' });
    const entry = log.at(-1)!;
    expect(entry).toMatchObject({ kind: 'action', action: 'openIncident', who: 'רועי (1234)', desk: '102', incidentId: '1001' });
    expect(entry.text).toContain('הוזנקו:');
  });

  it('פעולה מהטאבלט נרשמת בשם הרכב', () => {
    const { e, log } = setup();
    e.apply({ type: 'vehicleAction', vehicleId: '1-440', action: 'offline' }, { vehicleId: '1-440' });
    expect(log.at(-1)!.who).toMatch(/^טאבלט .*440/);
  });

  it('מוקדן שכל החלונות שלו נסגרו מנותק אוטומטית; איפוס הדמיה לא מנתק', () => {
    const { e, log, advance } = setup();
    e.apply({ type: 'login', badge: '1234', name: 'רועי', desk: 'ops', windowId: 'w1' });
    e.apply({ type: 'reset' });
    expect(e.state.operators).toHaveLength(1);
    e.apply({ type: 'windowClosed', windowId: 'w1' });
    advance(SESSION_TIMING.operatorTimeoutMs - 1000);
    expect(e.state.operators).toHaveLength(1);
    advance(2000);
    expect(e.state.operators).toHaveLength(0);
    expect(log.at(-1)).toMatchObject({ action: 'logout', badge: '1234' });
    expect(log.at(-1)!.text).toContain('ניתוק אוטומטי');
  });

  it('ניתוק ע״י מוקדן אחר נרשם עם שם המנתק', () => {
    const { e, log } = setup();
    e.apply({ type: 'login', badge: '1111', name: 'א', desk: 'super', windowId: 'w1' });
    e.apply({ type: 'login', badge: '2222', name: 'ב', desk: '102', windowId: 'w2' });
    e.apply({ type: 'logout', badge: '2222' }, { badge: '1111' });
    expect(e.state.operators.map((o) => o.badge)).toEqual(['1111']);
    expect(log.at(-1)!.text).toContain('ניתוק ע״י א (1111)');
  });
});
