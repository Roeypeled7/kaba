import { AMBULANCE_SPEED_KMH, DEFAULT_SPEED, DISTRICT, INCIDENT_TYPE, TIMING, UNIT_LABEL, UNIT_SPEED_KMH, buildWorld } from './config';
import { DISTRICT_OFFICER_ID, applyRotation, assignTeams, distKm, needDelta, recommend, requirement, type Need } from './dispatch';
import { etaMin, makeCall, moveToward, nextCallDelayMs } from './simulation';
import type { Ambulance, Assignment, ChannelId, Command, Incident, SimState, Vehicle } from './model';

const MAX_RADIO = 400;
const MAX_CALLS = 6;

export function initialState(now: number): SimState {
  const { stations, vehicles, ambulances } = buildWorld(now);
  return {
    version: 0,
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
    pendingReplies: [],
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Engine {
  state: SimState;
  private listeners = new Set<(s: SimState) => void>();

  constructor(now = Date.now()) {
    this.state = initialState(now);
  }

  subscribe(fn: (s: SimState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
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
  private channelOf(v: Vehicle): ChannelId {
    return v.id === DISTRICT_OFFICER_ID ? 'district' : `st${v.stationId}`;
  }
  private radio(channel: ChannelId, from: string, to: string, text: string, incidentId?: string, outgoing = false) {
    this.state.radio.push({ id: this.nextId(), t: this.now, channel, from, to, text, incidentId, outgoing });
    if (this.state.radio.length > MAX_RADIO) this.state.radio.splice(0, this.state.radio.length - MAX_RADIO);
  }
  private log(inc: Incident, text: string) {
    inc.log.push({ t: this.now, text });
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
      const teams = [...new Set(list.map((a) => a.team).filter(Boolean))].join(' + ');
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
      this.radio(`st${stationId}`, 'מוקד', st.name, `הזנקה! ${this.label(inc)} — ${inc.address}. כוחות: ${signs}${teams ? ` · צוות ${teams}` : ''}`, inc.id, true);
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
    const rec = recommend(this.state, inc.pos, need, inc.severity);
    this.dispatch(inc, rec.assignments);
    const missing = Object.entries(rec.shortage) as [keyof typeof UNIT_LABEL, number][];
    if (missing.length) {
      for (const [k, n] of missing) inc.shortage[k] = (inc.shortage[k] ?? 0) + n;
      const txt = missing.map(([k, n]) => `${n} ${UNIT_LABEL[k]}`).join(', ');
      this.radio('district', 'מערכת', 'מוקד', `⚠ חוסר כוחות לאירוע ${inc.id}: ${txt} — אין כוח זמין במחוז`, inc.id);
      this.log(inc, `חוסר כוחות: ${txt}`);
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

  // ───────────── פקודות ─────────────
  apply(cmd: Command) {
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
        };
        s.incidents.push(inc);
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
        if (st.turnTeam !== cmd.team) {
          st.turnTeam = cmd.team;
          this.radio(`st${st.id}`, st.name, 'מוקד', `התור הועבר ידנית לצוות ${cmd.team}`);
        }
        break;
      }
      case 'sendRadio': {
        this.radio(cmd.channel, 'מוקד', cmd.to, cmd.text, cmd.incidentId, true);
        const v = s.vehicles.find((x) => x.callsign === cmd.to);
        const st = s.stations.find((x) => x.name === cmd.to);
        if (v) this.schedule(rand(4, 9), this.channelOf(v), v.callsign, /דווח|מצב|עדכן/.test(cmd.text) ? this.statusReply(v) : 'רשמתי', cmd.incidentId);
        else if (st) this.schedule(rand(3, 7), `st${st.id}`, st.name, 'קיבלתי', cmd.incidentId);
        else if (cmd.channel === 'mda') this.schedule(rand(5, 10), 'mda', 'מד״א', 'קיבלתי', cmd.incidentId);
        else if (cmd.channel === 'police') this.schedule(rand(5, 10), 'police', 'מוקד משטרה', 'קיבלתי', cmd.incidentId);
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
        if (s.calls.length < MAX_CALLS) s.calls.push(makeCall(`K${this.nextId()}`, this.now));
        break;
      case 'reset': {
        const keep = { speed: s.speed, callRate: s.callRate };
        this.state = { ...initialState(Date.now()), ...keep, version: s.version };
        break;
      }
    }
    this.emit();
  }

  // ───────────── שעון ─────────────
  tick(realDtMs: number) {
    const s = this.state;
    if (s.paused) return;
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
      if (s.calls.length < MAX_CALLS) s.calls.push(makeCall(`K${this.nextId()}`, now));
      s.nextCallAt = now + nextCallDelayMs(s.callRate);
    }

    // תשובות מתוזמנות בקשר
    if (s.pendingReplies.some((p) => p.at <= now)) {
      for (const p of s.pendingReplies.filter((p) => p.at <= now)) this.radio(p.channel, p.from, 'מוקד', p.text, p.incidentId);
      s.pendingReplies = s.pendingReplies.filter((p) => p.at > now);
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
            this.setStatus(a, 'transporting');
            this.radio('mda', 'מד״א', 'מוקד כבאות', `${a.callsign} מפנה פצוע ל${DISTRICT.hospital.name}`, a.incidentId ?? undefined);
            if (inc) this.log(inc, `${a.callsign} מפנה ל${DISTRICT.hospital.name}`);
          }
          break;
        case 'transporting':
          if (moveToward(a.pos, DISTRICT.hospital.pos, AMBULANCE_SPEED_KMH, dt)) this.setStatus(a, 'returning');
          break;
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
