import { AMBULANCE_SPEED_KMH, BREAK_REASON, DEFAULT_SPEED, DESK_LABEL, DISTRICT, INCIDENT_TYPE, SESSION_TIMING, TIMING, UNIT_LABEL, UNIT_SPEED_KMH, buildWorld } from './config';
import { describeCommand } from './audit';
import { applyRotation, assignTeams, distKm, mainStationId, nearestHospital, needDelta, recommend, requirement, type Need } from './dispatch';
import { etaMin, makeCall, moveToward, nextCallDelayMs } from './simulation';
import type { Actor, Ambulance, Assignment, AuditEntry, ChannelId, Command, Incident, IncidentMedia, Operator, SimState, Station, Vehicle } from './model';

const MAX_RADIO = 400;
const MAX_CALLS = 6;
/** פקודות שמותרות גם למוקדן בהפסקה / לא מחובר */
const SESSION_CMDS = new Set<Command['type']>(['login', 'logout', 'setBreak', 'heartbeat', 'windowClosed']);

/** ‎1:05:09 */
export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function initialState(now: number): SimState {
  const { stations, vehicles, ambulances } = buildWorld(now);
  return {
    version: 0,
    bootId: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    simTime: now,
    speed: DEFAULT_SPEED,
    paused: false,
    autoDispatch: true,
    callRate: 'low',
    nextCallAt: now + 20_000,
    seq: 1,
    stations,
    vehicles,
    ambulances,
    incidents: [],
    calls: [],
    dispatches: [],
    radio: [
      { id: 0, t: now, channel: 'district', from: 'מוקד', to: 'כל התחנות', text: `המערכת עלתה. ${DISTRICT.name} — כל הכוחות כשירים.`, outgoing: true },
    ],
    mdaPending: [],
    pendingUpdates: [],
    pendingReplies: [],
    operators: [],
  };
}

/** עדכונים שמדווחים שולחים למוקד אחרי פתיחת האירוע — לפי סוג האירוע */
const SCENE_UPDATES: Record<string, { after: [number, number]; from: string; text: string; media?: 'photo' | 'video' }[]> = {
  structure: [
    { after: [15, 30], from: 'המדווח', text: 'תמונה מהחזית — עשן שחור מחלונות הקומה השלישית', media: 'photo' },
    { after: [50, 90], from: 'עובר אורח', text: 'סרטון מהכביש: להבות נראות מהחלון השמאלי', media: 'video' },
    { after: [120, 170], from: 'ועד הבית', text: 'כל הדיירים יצאו, חוץ מדירה 9 — קשישה שלא עונה לדלת' },
  ],
  vehicle: [
    { after: [15, 30], from: 'המדווח', text: 'תמונה מהחניה — האש בתא המנוע', media: 'photo' },
    { after: [45, 80], from: 'עובר אורח', text: 'סרטון: האש מתפשטת לרכב הסמוך', media: 'video' },
  ],
  brush: [
    { after: [15, 30], from: 'המדווח', text: 'תמונה מהשביל — חזית האש מתקדמת עם הרוח מזרחה', media: 'photo' },
    { after: [60, 100], from: 'תושב', text: 'סרטון מהגג: העשן מגיע לבתים הראשונים', media: 'video' },
    { after: [130, 180], from: 'מוקד', text: 'רוח מערבית 25 קמ״ש, מתחזקת' },
  ],
  mva: [
    { after: [15, 30], from: 'המדווח', text: 'תמונה מהזירה — רכב הפוך על הגג, נהג בפנים', media: 'photo' },
    { after: [40, 70], from: 'נהג חולף', text: 'סרטון: דליפת דלק מתחת לרכב', media: 'video' },
    { after: [90, 130], from: 'מד״א', text: 'הלכוד בהכרה, לחוץ ברגליים. נדרש חילוץ מהיר' },
  ],
  hazmat: [
    { after: [20, 40], from: 'אחראי משמרת במפעל', text: 'תמונת שלט המכל — UN 1017 כלור', media: 'photo' },
    { after: [60, 100], from: 'עובד', text: 'סרטון: ענן לבן-ירקרק נע לכיוון הכביש', media: 'video' },
    { after: [120, 160], from: 'מוקד', text: '3 עובדים עם קשיי נשימה פונו למרפאת המפעל' },
  ],
  rescue: [
    { after: [15, 30], from: 'המדווח', text: 'תמונה — העובד תקוע על הפיגום בקומה 5', media: 'photo' },
    { after: [60, 100], from: 'מנהל העבודה', text: 'סרטון: הפיגום לא יציב, זז ברוח', media: 'video' },
  ],
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Engine {
  state: SimState;
  private listeners = new Set<(s: SimState) => void>();
  private auditListeners = new Set<(e: AuditEntry) => void>();
  private auditSeq = 0;
  /** זמן אמת — ניתן להחלפה בבדיקות */
  clock: () => number = Date.now;

  constructor(now = Date.now()) {
    this.state = initialState(now);
  }

  subscribe(fn: (s: SimState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** כל רשומת יומן חדשה */
  onAudit(fn: (e: AuditEntry) => void): () => void {
    this.auditListeners.add(fn);
    return () => this.auditListeners.delete(fn);
  }

  private audit(e: Omit<AuditEntry, 'id' | 'at' | 't'>) {
    const at = this.clock();
    const entry: AuditEntry = { id: `${at.toString(36)}-${(this.auditSeq++).toString(36)}`, at, t: this.now, ...e };
    for (const l of this.auditListeners) l(entry);
  }

  operator(badge: string | undefined) {
    return badge ? this.state.operators.find((o) => o.badge === badge) : undefined;
  }

  /** מי ביצע — לשורת היומן */
  private who(actor: Actor): Pick<AuditEntry, 'who' | 'badge' | 'desk' | 'vehicleId'> {
    const op = this.operator(actor.badge);
    if (op) return { who: `${op.name} (${op.badge})`, badge: op.badge, desk: op.desk };
    if (actor.badge) return { who: `מס׳ ${actor.badge} (לא מחובר)`, badge: actor.badge };
    if (actor.vehicleId) return { who: `טאבלט ${this.vehicle(actor.vehicleId)?.callsign ?? actor.vehicleId}`, vehicleId: actor.vehicleId };
    return { who: 'לא מזוהה' };
  }

  private emit() {
    this.state.version++;
    for (const l of this.listeners) l(this.state);
  }

  // ───────────── עזרים ─────────────
  private get now() {
    return this.state.simTime;
  }
  private nextId() {
    return this.state.seq++;
  }
  vehicle(id: string) {
    return this.state.vehicles.find((v) => v.id === id);
  }
  incident(id: string | null) {
    return id ? this.state.incidents.find((i) => i.id === id) : undefined;
  }
  station(id: number) {
    return this.state.stations.find((s) => s.id === id)!;
  }
  /** ערוץ הקשר של תחנה — תמיד הערוץ של התחנה הראשית */
  private stationChannel(st: Station): ChannelId {
    return `st${mainStationId(st)}`;
  }
  private channelOf(v: Vehicle): ChannelId {
    return this.stationChannel(this.station(v.stationId));
  }
  /** בית החולים שאליו מפנה אמבולנס — הקרוב לזירה (או לאמבולנס, אם אין אירוע) */
  private hospitalFor(a: Ambulance) {
    return nearestHospital(this.incident(a.incidentId)?.pos ?? a.pos);
  }
  private radio(channel: ChannelId, from: string, to: string, text: string, incidentId?: string, outgoing = false) {
    this.state.radio.push({ id: this.nextId(), t: this.now, channel, from, to, text, incidentId, outgoing });
    if (this.state.radio.length > MAX_RADIO) this.state.radio.splice(0, this.state.radio.length - MAX_RADIO);
  }
  private log(inc: Incident, text: string) {
    inc.log.push({ t: this.now, text });
  }
  /** עדכון זירה — נרשם באירוע ומשודר לכוחות בערוץ המחוזי */
  private addUpdate(inc: Incident, from: string, text: string, media?: IncidentMedia) {
    inc.updates.push({ id: this.nextId(), t: this.now, from, text, media });
    const tag = media ? (media.kind === 'video' ? ' 🎥' : ' 📷') : '';
    this.radio('district', 'מוקד', `כוחות אירוע ${inc.id}`, `עדכון מ${from}:${tag} ${text}`, inc.id, true);
  }
  private setStatus(v: Vehicle, status: Vehicle['status']): void;
  private setStatus(v: Ambulance, status: Ambulance['status']): void;
  private setStatus(v: Vehicle | Ambulance, status: string) {
    (v as { status: string }).status = status;
    v.statusSince = this.now;
  }
  private label(inc: Incident) {
    return INCIDENT_TYPE[inc.typeKey].label;
  }
  private schedule(delaySec: number, channel: ChannelId, from: string, text: string, incidentId?: string) {
    this.state.pendingReplies.push({ at: this.now + delaySec * 1000, channel, from, text, incidentId });
  }

  // ───────────── הזנקה ─────────────
  private dispatch(inc: Incident, assignments: Assignment[]) {
    if (!assignments.length) return;
    for (const a of assignments) {
      const v = this.vehicle(a.vehicleId)!;
      this.setStatus(v, 'dispatched');
      v.incidentId = inc.id;
      if (a.team) v.crewTeam = a.team;
      if (!inc.vehicleIds.includes(v.id)) inc.vehicleIds.push(v.id);
    }
    applyRotation(this.state.stations, assignments);

    const byStation = new Map<number, Assignment[]>();
    for (const a of assignments) byStation.set(a.stationId, [...(byStation.get(a.stationId) ?? []), a]);
    for (const [stationId, list] of byStation) {
      const st = this.station(stationId);
      const team = list.find((a) => a.team)?.team ?? null;
      this.state.dispatches.push({
        id: `D${this.nextId()}`,
        stationId,
        incidentId: inc.id,
        team,
        vehicleIds: list.map((a) => a.vehicleId),
        t: this.now,
        ack: false,
      });
      const signs = list.map((a) => this.vehicle(a.vehicleId)!.callsign).join(', ');
      this.radio(this.stationChannel(st), 'מוקד', st.name, `הזנקה! ${this.label(inc)} — ${inc.address}. כוחות: ${signs}`, inc.id, true);
    }
    const allSigns = assignments.map((a) => this.vehicle(a.vehicleId)!.callsign).join(', ');
    this.radio('district', 'מוקד', 'כל התחנות', `אירוע ${inc.id} · ${this.label(inc)}, ${inc.address} — הוזנקו: ${allSigns}`, inc.id, true);
    this.log(inc, `הוזנקו: ${allSigns}`);
    if (inc.status === 'new') inc.status = 'dispatched';

    const type = INCIDENT_TYPE[inc.typeKey];
    if (type.ambulance && !inc.ambulanceRequested) this.requestAmbulance(inc);
    if (type.police && !inc.policeNotified) this.notifyPolice(inc);
  }

  private autoDispatch(inc: Incident, need: Need) {
    const rec = recommend(this.state, inc.pos, need, inc.severity, inc.id);
    this.dispatch(inc, rec.assignments);
    const missing = Object.entries(rec.shortage) as [keyof typeof UNIT_LABEL, number][];
    if (missing.length) {
      for (const [k, n] of missing) inc.shortage[k] = (inc.shortage[k] ?? 0) + n;
      const txt = missing.map(([k, n]) => `${n} ${UNIT_LABEL[k]}`).join(', ');
      this.radio('district', 'מערכת', 'מוקד', `⚠ חוסר כוחות לאירוע ${inc.id}: ${txt} — אין כוח זמין במחוז`, inc.id);
      this.log(inc, `חוסר כוחות: ${txt}`);
      this.audit({ kind: 'system', action: 'shortage', who: 'מערכת', incidentId: inc.id, text: `חוסר כוחות לאירוע ${inc.id}: ${txt}` });
    }
  }

  private requestAmbulance(inc: Incident) {
    inc.ambulanceRequested = true;
    this.radio('mda', 'מוקד כבאות', 'מד״א', `מבקשים אמבולנס לאירוע ${this.label(inc)}, ${inc.address}`, inc.id, true);
    this.log(inc, 'נשלחה בקשת אמבולנס למד״א');
    this.state.mdaPending.push({ incidentId: inc.id, at: this.now + rand(...TIMING.mdaReply) * 1000 });
  }

  private notifyPolice(inc: Incident) {
    inc.policeNotified = true;
    this.radio('police', 'מוקד כבאות', 'מוקד משטרה', `עדכון: ${this.label(inc)}, ${inc.address}. נדרשת חסימת צירים`, inc.id, true);
    this.log(inc, 'עודכנה משטרה');
    this.schedule(rand(15, 30), 'police', 'מוקד משטרה', `קיבלנו. ניידת בדרך ל${inc.address}, נחסום צירים`, inc.id);
  }

  // ───────────── מעברי סטטוס ─────────────
  private depart(v: Vehicle) {
    const inc = this.incident(v.incidentId);
    this.setStatus(v, 'enroute');
    if (inc) this.radio(this.channelOf(v), v.callsign, 'מוקד', `יצאנו לאירוע ${inc.id}, זמן הגעה משוער ${etaMin(v.pos, inc.pos, UNIT_SPEED_KMH[v.type])} דק׳`, inc.id);
  }

  private arrive(v: Vehicle, inc: Incident) {
    v.pos = { ...inc.pos };
    this.setStatus(v, 'onscene');
    const first = inc.status === 'dispatched';
    this.radio(this.channelOf(v), v.callsign, 'מוקד', first ? `ראשונים בזירה. ${inc.notes || 'מתחילים בטיפול'}` : 'הגענו לזירה', inc.id);
    this.log(inc, `${v.callsign} בזירה`);
    if (first) inc.status = 'active';
  }

  private startReturn(v: Vehicle, text = 'פנויים, חוזרים לתחנה') {
    this.setStatus(v, 'returning');
    this.radio(this.channelOf(v), v.callsign, 'מוקד', text, v.incidentId ?? undefined);
  }

  private home(v: Vehicle, announce = true) {
    v.pos = { ...this.station(v.stationId).pos };
    this.setStatus(v, 'available');
    v.incidentId = null;
    v.crewTeam = v.homeTeam;
    if (announce) this.radio(this.channelOf(v), v.callsign, 'מוקד', 'בתחנה, כשירים', undefined);
  }

  /** ביטול רכב שטרם יצא — חוזר לזמינות מיידית */
  private cancel(v: Vehicle) {
    const incId = v.incidentId;
    this.home(v, false);
    this.radio(this.channelOf(v), 'מוקד', v.callsign, 'ביטול הזנקה — הישארו בתחנה', incId ?? undefined, true);
  }

  private controlled(inc: Incident) {
    inc.status = 'controlled';
    const onScene = this.state.vehicles.filter((v) => v.incidentId === inc.id && v.status === 'onscene');
    const senior = onScene.find((v) => v.type === 'commander') ?? onScene[0];
    this.radio('district', senior?.callsign ?? 'זירה', 'מוקד', `אירוע ${inc.id} נשלט. משחרר כוחות`, inc.id);
    this.log(inc, 'האירוע נשלט');
    this.audit({ kind: 'system', action: 'controlled', who: 'מערכת', incidentId: inc.id, text: `אירוע ${inc.id} נשלט — שחרור כוחות` });
    for (const v of this.state.vehicles.filter((x) => x.incidentId === inc.id)) {
      if (v.status === 'onscene') this.setStatus(v, 'cleared');
      else if (v.status === 'dispatched') this.cancel(v);
      else if (v.status === 'enroute') this.startReturn(v, 'קיבלתי ביטול, חוזרים לתחנה');
    }
  }

  private close(inc: Incident, text: string) {
    inc.status = 'closed';
    inc.closedAt = this.now;
    this.log(inc, text);
    this.radio('district', 'מוקד', 'כל התחנות', `אירוע ${inc.id} (${this.label(inc)}) — ${text}`, inc.id, true);
    this.audit({ kind: 'system', action: 'closed', who: 'מערכת', incidentId: inc.id, text: `אירוע ${inc.id} נסגר — ${text}` });
  }

  private statusReply(v: Vehicle): string {
    const inc = this.incident(v.incidentId);
    switch (v.status) {
      case 'available':
        return 'בתחנה, כשירים';
      case 'dispatched':
        return 'מתארגנים ליציאה';
      case 'enroute':
        return inc ? `בדרך, זמן הגעה משוער ${etaMin(v.pos, inc.pos, UNIT_SPEED_KMH[v.type])} דק׳` : 'בדרך';
      case 'onscene':
        return inc ? `בזירה. מתקדמים בטיפול, משוער עוד ${Math.max(1, Math.ceil(inc.workLeft / 60))} דק׳` : 'בזירה';
      case 'cleared':
        return 'פנויים בזירה';
      case 'returning':
        return 'חוזרים לתחנה';
      case 'offline':
        return 'לא כשירים';
    }
  }

  private incomingCall() {
    const c = makeCall(`K${this.nextId()}`, this.now);
    this.state.calls.push(c);
    this.audit({ kind: 'system', action: 'call', who: 'מערכת', text: `קריאה נכנסת ${c.id}: ${INCIDENT_TYPE[c.typeKey].label} — ${c.caller}, ${c.phone}` });
  }

  // ───────────── מוקדנים ─────────────
  private session(cmd: Extract<Command, { type: 'login' | 'logout' | 'setBreak' | 'heartbeat' | 'windowClosed' }>, actor: Actor) {
    const s = this.state;
    const t = this.clock();
    switch (cmd.type) {
      case 'login': {
        const badge = cmd.badge.trim();
        const name = cmd.name.trim();
        if (!badge || !name) return;
        const op = this.operator(badge);
        if (op) {
          op.windows[cmd.windowId] = t;
          op.lastSeen = t;
          this.audit({ kind: 'session', action: 'login', ...this.who({ badge }), text: `כניסה מחלון נוסף · ${DESK_LABEL[op.desk]}` });
          return;
        }
        s.operators.push({ badge, name, desk: cmd.desk, loginAt: cmd.resume?.loginAt ?? t, onBreak: null, statusSince: t, breakMs: 0, breaks: 0, windows: { [cmd.windowId]: t }, lastSeen: t });
        const how = cmd.resume ? 'חידוש כניסה אחרי הפעלה מחדש של המנוע' : 'כניסה למערכת';
        this.audit({ kind: 'session', action: 'login', ...this.who({ badge }), text: `${how} · ${DESK_LABEL[cmd.desk]}` });
        return;
      }
      case 'logout': {
        const op = this.operator(cmd.badge);
        if (!op) return;
        const by = actor.badge && actor.badge !== op.badge ? this.who(actor) : null;
        this.endShift(op, by ? `ניתוק ע״י ${by.who}` : 'יציאה מהמערכת');
        return;
      }
      case 'setBreak': {
        const op = this.operator(cmd.badge);
        if (!op || op.onBreak === cmd.reason) return;
        const prev = op.onBreak;
        if (prev) {
          op.breakMs += t - op.statusSince;
          op.breaks++;
        }
        const took = fmtDuration(t - op.statusSince);
        const over = prev && t - op.statusSince > BREAK_REASON[prev].limitMin * 60_000 ? ' · חריגה' : '';
        op.onBreak = cmd.reason;
        op.statusSince = t;
        const by = actor.badge && actor.badge !== op.badge ? ` (ע״י ${this.who(actor).who})` : '';
        const text = cmd.reason
          ? `יציאה להפסקה: ${BREAK_REASON[cmd.reason].label}${prev ? ` (אחרי ${BREAK_REASON[prev].label}, ${took})` : ''}`
          : `חזרה לעמדה אחרי ${BREAK_REASON[prev!].label} · ${took}${over}`;
        this.audit({ kind: 'session', action: cmd.reason ? 'break' : 'back', ...this.who({ badge: op.badge }), text: text + by });
        return;
      }
      case 'heartbeat': {
        const op = this.operator(cmd.badge);
        if (!op) return;
        op.windows[cmd.windowId] = t;
        op.lastSeen = t;
        return;
      }
      case 'windowClosed':
        for (const op of s.operators) delete op.windows[cmd.windowId];
        return;
    }
  }

  private endShift(op: Operator, reason: string) {
    const t = this.clock();
    const breakMs = op.breakMs + (op.onBreak ? t - op.statusSince : 0);
    const breaks = op.breaks + (op.onBreak ? 1 : 0);
    this.state.operators = this.state.operators.filter((o) => o !== op);
    this.audit({
      kind: 'session',
      action: 'logout',
      who: `${op.name} (${op.badge})`,
      badge: op.badge,
      desk: op.desk,
      text: `${reason} · משמרת ${fmtDuration(t - op.loginAt)} · ${breaks} הפסקות (${fmtDuration(breakMs)})`,
    });
  }

  /** חלונות שהפסיקו לשלוח פעימה נמחקים; מוקדן בלי חלונות מנותק אוטומטית. מחזיר אם משהו השתנה */
  private sweepOperators(): boolean {
    const t = this.clock();
    let changed = false;
    for (const op of [...this.state.operators]) {
      for (const [w, seen] of Object.entries(op.windows))
        if (t - seen > SESSION_TIMING.windowStaleMs) {
          delete op.windows[w];
          changed = true;
        }
      if (!Object.keys(op.windows).length && t - op.lastSeen > SESSION_TIMING.operatorTimeoutMs) {
        this.endShift(op, 'ניתוק אוטומטי — כל החלונות נסגרו');
        changed = true;
      }
    }
    return changed;
  }

  // ───────────── פקודות ─────────────
  apply(cmd: Command, actor: Actor = {}) {
    if (SESSION_CMDS.has(cmd.type)) {
      this.session(cmd as Parameters<Engine['session']>[0], actor);
      this.emit();
      return;
    }
    const desc = describeCommand(this.state, cmd);
    const op = this.operator(actor.badge);
    // חלון משל״ט שהמוקדן שלו בהפסקה או לא מחובר — הפעולה לא מבוצעת, רק נרשמת
    if (actor.badge && (!op || op.onBreak)) {
      this.audit({ kind: 'blocked', action: cmd.type, ...this.who(actor), incidentId: desc?.incidentId, text: `נחסם (${op ? 'בהפסקה' : 'לא מחובר'}): ${desc?.text ?? cmd.type}` });
      this.emit();
      return;
    }
    const inc = desc?.incidentId ? this.incident(desc.incidentId) : undefined;
    const before = inc?.vehicleIds.length ?? 0;
    this.run(cmd);
    if (!desc) return;
    // מה ההזנקה שנבעה מהפקודה (שיגור אוטומטי, תגבור, העלאת חומרה) — נרשם באותה שורה
    const after = this.incident(desc.incidentId ?? null);
    const added = after ? after.vehicleIds.slice(after === inc ? before : 0) : [];
    const signs = added.map((id) => this.vehicle(id)?.callsign ?? id).join(', ');
    const dispatched = signs && cmd.type !== 'dispatchUnits' ? ` → הוזנקו: ${signs}` : '';
    this.audit({ kind: 'action', action: cmd.type, ...this.who(actor), incidentId: desc.incidentId, text: desc.text + dispatched });
  }

  private run(cmd: Command) {
    const s = this.state;
    switch (cmd.type) {
      case 'openIncident': {
        const type = INCIDENT_TYPE[cmd.typeKey];
        const inc: Incident = {
          id: String(1001 + s.incidents.length),
          typeKey: cmd.typeKey,
          severity: cmd.severity,
          address: cmd.address,
          pos: cmd.pos,
          caller: cmd.caller,
          phone: cmd.phone,
          notes: cmd.notes,
          status: 'new',
          openedAt: this.now,
          closedAt: null,
          workLeft: type.workMin * 60 * (1 + 0.5 * (cmd.severity - 1)),
          vehicleIds: [],
          ambulanceIds: [],
          ambulanceRequested: false,
          policeNotified: false,
          shortage: {},
          log: [],
          updates: [],
        };
        s.incidents.push(inc);
        for (const u of SCENE_UPDATES[cmd.typeKey] ?? [])
          s.pendingUpdates.push({
            at: this.now + rand(u.after[0], u.after[1]) * 1000,
            incidentId: inc.id,
            from: u.from,
            text: u.text,
            media: u.media ? { kind: u.media, seed: this.nextId(), ...(u.media === 'video' ? { duration: Math.round(rand(8, 24)) } : {}) } : undefined,
          });
        if (cmd.callId) s.calls = s.calls.filter((c) => c.id !== cmd.callId);
        this.log(inc, `נפתח אירוע: ${type.label}, חומרה ${cmd.severity}`);
        if (s.autoDispatch) this.autoDispatch(inc, requirement(inc.typeKey, inc.severity));
        break;
      }
      case 'dropCall':
        s.calls = s.calls.filter((c) => c.id !== cmd.callId);
        break;
      case 'dispatchRecommended': {
        const inc = this.incident(cmd.incidentId);
        if (inc && inc.status === 'new') this.autoDispatch(inc, requirement(inc.typeKey, inc.severity));
        break;
      }
      case 'dispatchUnits': {
        const inc = this.incident(cmd.incidentId);
        if (!inc || inc.status === 'closed' || inc.status === 'controlled') break;
        const ids = cmd.vehicleIds.filter((id) => this.vehicle(id)?.status === 'available');
        this.dispatch(inc, assignTeams(s, ids));
        break;
      }
      case 'reinforce': {
        const inc = this.incident(cmd.incidentId);
        if (!inc || inc.status === 'closed' || inc.status === 'controlled') break;
        this.log(inc, `בקשת תגבור: ${UNIT_LABEL[cmd.unitType]}`);
        this.autoDispatch(inc, { [cmd.unitType]: 1 });
        break;
      }
      case 'setSeverity': {
        const inc = this.incident(cmd.incidentId);
        if (!inc || inc.status === 'closed' || cmd.severity === inc.severity) break;
        const delta = needDelta(requirement(inc.typeKey, inc.severity), requirement(inc.typeKey, cmd.severity));
        const workTotal = INCIDENT_TYPE[inc.typeKey].workMin * 60;
        inc.workLeft = Math.max(60, inc.workLeft + workTotal * 0.5 * (cmd.severity - inc.severity));
        this.log(inc, `חומרה עודכנה: ${inc.severity} → ${cmd.severity}`);
        inc.severity = cmd.severity;
        if (inc.status !== 'new' && inc.status !== 'controlled' && Object.keys(delta).length) this.autoDispatch(inc, delta);
        break;
      }
      case 'releaseUnit': {
        const v = this.vehicle(cmd.vehicleId);
        if (!v || !v.incidentId) break;
        if (v.status === 'dispatched') this.cancel(v);
        else if (v.status === 'enroute' || v.status === 'onscene' || v.status === 'cleared') {
          this.radio(this.channelOf(v), 'מוקד', v.callsign, 'משוחררים מהאירוע', v.incidentId, true);
          this.startReturn(v, 'קיבלתי, חוזרים לתחנה');
        }
        break;
      }
      case 'addUpdate': {
        const inc = this.incident(cmd.incidentId);
        if (!inc || inc.status === 'closed') break;
        this.addUpdate(inc, cmd.from ?? 'מוקד', cmd.text, cmd.media);
        break;
      }
      case 'closeIncident': {
        const inc = this.incident(cmd.incidentId);
        if (!inc || inc.status === 'closed') break;
        for (const v of s.vehicles.filter((x) => x.incidentId === inc.id)) {
          if (v.status === 'dispatched') this.cancel(v);
          else if (v.status === 'enroute' || v.status === 'onscene' || v.status === 'cleared') this.startReturn(v);
        }
        s.mdaPending = s.mdaPending.filter((p) => p.incidentId !== inc.id);
        this.close(inc, 'נסגר ע״י המוקד');
        break;
      }
      case 'vehicleAction': {
        const v = this.vehicle(cmd.vehicleId);
        if (!v) break;
        const inc = this.incident(v.incidentId);
        if (cmd.action === 'depart' && v.status === 'dispatched') this.depart(v);
        else if (cmd.action === 'arrive' && inc && (v.status === 'enroute' || v.status === 'dispatched')) this.arrive(v, inc);
        else if (cmd.action === 'clear' && (v.status === 'onscene' || v.status === 'cleared')) this.startReturn(v);
        else if (cmd.action === 'home' && v.status !== 'offline' && v.status !== 'available') this.home(v);
        else if (cmd.action === 'offline' && v.status === 'available') {
          this.setStatus(v, 'offline');
          this.radio(this.channelOf(v), v.callsign, 'מוקד', 'יוצאים מכשירות (תקלה)');
        } else if (cmd.action === 'online' && v.status === 'offline') this.home(v);
        break;
      }
      case 'ackDispatch': {
        const d = s.dispatches.find((x) => x.id === cmd.dispatchId);
        if (d) d.ack = true;
        break;
      }
      case 'setTurnTeam': {
        const st = this.station(cmd.stationId);
        if (st && st.teamOrder.includes(cmd.team) && st.turnTeam !== cmd.team) {
          st.turnTeam = cmd.team;
          this.radio(this.stationChannel(st), st.name, 'מוקד', `התור הועבר ידנית לצוות ${st.teams[cmd.team]?.unit ?? cmd.team}`);
        }
        break;
      }
      case 'setVehicleCrew': {
        const v = this.vehicle(cmd.vehicleId);
        if (!v) break;
        v.crew = cmd.crew.map((m) => ({ ...m }));
        // השם שמוצג ליד הרכב בשאר העמדות — מפקד הצוות, או הראשון ברשימה
        const lead = v.crew.find((m) => m.role === 'commander') ?? v.crew[0];
        if (lead) v.crewName = lead.name;
        break;
      }
      case 'sendRadio': {
        this.radio(cmd.channel, 'מוקד', cmd.to, cmd.text, cmd.incidentId, true);
        const v = s.vehicles.find((x) => x.callsign === cmd.to);
        const st = s.stations.find((x) => x.name === cmd.to);
        if (v) this.schedule(rand(4, 9), this.channelOf(v), v.callsign, /דווח|מצב|עדכן/.test(cmd.text) ? this.statusReply(v) : 'רשמתי', cmd.incidentId);
        else if (st) this.schedule(rand(3, 7), this.stationChannel(st), st.name, 'קיבלתי', cmd.incidentId);
        else if (cmd.channel === 'mda') this.schedule(rand(5, 10), 'mda', 'מד״א', 'קיבלתי', cmd.incidentId);
        else if (cmd.channel === 'police') this.schedule(rand(5, 10), 'police', 'מוקד משטרה', 'קיבלתי', cmd.incidentId);
        break;
      }
      case 'unitRadio': {
        const v = this.vehicle(cmd.vehicleId);
        if (!v) break;
        const ch = this.channelOf(v);
        const incId = v.incidentId ?? undefined;
        this.radio(ch, v.callsign, 'מוקד', cmd.text, incId);
        const inc = this.incident(v.incidentId);
        if (inc) this.log(inc, `${v.callsign}: ${cmd.text}`);
        const reply = /בדיקת קשר/.test(cmd.text) ? `${v.callsign}, שומע אותך חזק וברור` : `${v.callsign}, קיבלתי`;
        s.pendingReplies.push({ at: this.now + rand(3, 7) * 1000, channel: ch, from: 'מוקד', to: v.callsign, text: reply, incidentId: incId });
        break;
      }
      case 'requestAmbulance': {
        const inc = this.incident(cmd.incidentId);
        if (inc && inc.status !== 'closed') this.requestAmbulance(inc);
        break;
      }
      case 'notifyPolice': {
        const inc = this.incident(cmd.incidentId);
        if (inc && inc.status !== 'closed') this.notifyPolice(inc);
        break;
      }
      case 'setAutoDispatch':
        s.autoDispatch = cmd.value;
        break;
      case 'setSpeed':
        s.speed = Math.max(1, Math.min(30, cmd.value));
        break;
      case 'setPaused':
        s.paused = cmd.value;
        break;
      case 'setCallRate':
        s.callRate = cmd.value;
        s.nextCallAt = this.now + Math.min(nextCallDelayMs(cmd.value), 30_000);
        break;
      case 'generateCall':
        if (s.calls.length < MAX_CALLS) this.incomingCall();
        break;
      case 'reset': {
        const keep = { speed: s.speed, callRate: s.callRate, operators: s.operators, bootId: s.bootId };
        this.state = { ...initialState(Date.now()), ...keep, version: s.version };
        break;
      }
      default:
        break;
    }
    this.emit();
  }

  // ───────────── שעון ─────────────
  tick(realDtMs: number) {
    const s = this.state;
    const swept = this.sweepOperators();
    if (s.paused) {
      if (swept) this.emit();
      return;
    }
    const dtMs = realDtMs * s.speed;
    s.simTime += dtMs;
    this.step(dtMs / 1000);
    this.emit();
  }

  private step(dt: number) {
    const s = this.state;
    const now = this.now;

    // קריאות נכנסות
    if (s.callRate !== 'off' && now >= s.nextCallAt) {
      if (s.calls.length < MAX_CALLS) this.incomingCall();
      s.nextCallAt = now + nextCallDelayMs(s.callRate);
    }

    // תשובות מתוזמנות בקשר
    if (s.pendingReplies.some((p) => p.at <= now)) {
      for (const p of s.pendingReplies.filter((p) => p.at <= now)) this.radio(p.channel, p.from, p.to ?? 'מוקד', p.text, p.incidentId, p.from === 'מוקד');
      s.pendingReplies = s.pendingReplies.filter((p) => p.at > now);
    }

    // עדכונים מהזירה שהגיע זמנם
    if (s.pendingUpdates.some((p) => p.at <= now)) {
      for (const p of s.pendingUpdates.filter((p) => p.at <= now)) {
        const inc = this.incident(p.incidentId);
        if (inc && inc.status !== 'closed') this.addUpdate(inc, p.from, p.text, p.media);
      }
      s.pendingUpdates = s.pendingUpdates.filter((p) => p.at > now);
    }

    // מד״א משבץ אמבולנס
    for (const p of s.mdaPending.filter((p) => p.at <= now)) {
      const inc = this.incident(p.incidentId);
      s.mdaPending = s.mdaPending.filter((x) => x !== p);
      if (!inc || inc.status === 'closed') continue;
      const amb = s.ambulances.filter((a) => a.status === 'available').sort((a, b) => distKm(a.pos, inc.pos) - distKm(b.pos, inc.pos))[0];
      if (!amb) {
        this.radio('mda', 'מד״א', 'מוקד כבאות', 'אין אמבולנס פנוי כרגע, נעדכן בהקדם', inc.id);
        s.mdaPending.push({ incidentId: inc.id, at: now + 60_000 });
        continue;
      }
      this.setStatus(amb, 'enroute');
      amb.incidentId = inc.id;
      inc.ambulanceIds.push(amb.id);
      this.radio('mda', 'מד״א', 'מוקד כבאות', `${amb.callsign} בדרך ל${inc.address}, זמן הגעה משוער ${etaMin(amb.pos, inc.pos, AMBULANCE_SPEED_KMH)} דק׳`, inc.id);
      this.log(inc, `מד״א: ${amb.callsign} בדרך`);
    }

    // רכבי כבאות
    for (const v of s.vehicles) {
      const inc = this.incident(v.incidentId);
      switch (v.status) {
        case 'dispatched':
          if (now - v.statusSince >= TIMING.turnout * 1000) this.depart(v);
          break;
        case 'enroute':
          if (!inc || inc.status === 'closed') this.startReturn(v);
          else if (moveToward(v.pos, inc.pos, UNIT_SPEED_KMH[v.type], dt)) this.arrive(v, inc);
          break;
        case 'cleared':
          if (now - v.statusSince >= TIMING.clearedToReturn * 1000) this.startReturn(v);
          break;
        case 'returning':
          if (moveToward(v.pos, this.station(v.stationId).pos, UNIT_SPEED_KMH[v.type], dt)) this.home(v);
          break;
      }
    }

    // התקדמות עבודה באירועים
    for (const inc of s.incidents) {
      if (inc.status === 'active' && s.vehicles.some((v) => v.incidentId === inc.id && v.status === 'onscene')) {
        inc.workLeft -= dt;
        if (inc.workLeft <= 0) this.controlled(inc);
      }
      if (inc.status === 'controlled') {
        const stillThere = s.vehicles.some((v) => v.incidentId === inc.id && ['dispatched', 'enroute', 'onscene', 'cleared'].includes(v.status));
        if (!stillThere) this.close(inc, 'הסתיים — כל הכוחות שוחררו');
      }
    }

    // אמבולנסים (מנוהלים ע״י מד״א)
    for (const a of s.ambulances) {
      const inc = this.incident(a.incidentId);
      switch (a.status) {
        case 'enroute':
          if (!inc) this.setStatus(a, 'returning');
          else if (moveToward(a.pos, inc.pos, AMBULANCE_SPEED_KMH, dt)) {
            this.setStatus(a, 'onscene');
            this.radio('mda', 'מד״א', 'מוקד כבאות', `${a.callsign} בזירה`, inc.id);
          }
          break;
        case 'onscene':
          if (now - a.statusSince >= TIMING.ambulanceOnScene * 1000) {
            const h = this.hospitalFor(a);
            this.setStatus(a, 'transporting');
            this.radio('mda', 'מד״א', 'מוקד כבאות', `${a.callsign} מפנה פצוע ל${h.name}`, a.incidentId ?? undefined);
            if (inc) this.log(inc, `${a.callsign} מפנה ל${h.name}`);
          }
          break;
        case 'transporting': {
          const h = this.hospitalFor(a);
          if (moveToward(a.pos, h.pos, AMBULANCE_SPEED_KMH, dt)) {
            this.setStatus(a, 'returning');
            this.radio('mda', 'מד״א', 'מוקד כבאות', `${a.callsign} הגיע ל${h.name}`, a.incidentId ?? undefined);
          }
          break;
        }
        case 'returning':
          if (moveToward(a.pos, a.base, AMBULANCE_SPEED_KMH * 0.8, dt)) {
            this.setStatus(a, 'available');
            a.incidentId = null;
          }
          break;
      }
    }
  }
}
