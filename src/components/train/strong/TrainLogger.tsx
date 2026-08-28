"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ---- Types ----
interface SetData { weight: number | null; reps: number | null; done: boolean; failed: boolean }
interface Lift {
  id: string; name: string; tier: number; muscle: string; libKey?: string; perHand?: boolean;
  targetSets: number; targetReps: number; weight: number; rest?: number; hidden: boolean;
  overload?: { weightKg: number; reps: number } | null;
  history: { w: number; r: number; date: string }[]; sets: SetData[];
}
interface Day { id: string; name: string; lifts: Lift[] }
interface DS { days: Day[]; activeDayId: string }

const GLYPH: Record<string, string> = {
  chest:'<path d="M3 9c2.5-2.4 6-2.4 9 .2c3-2.6 6.5-2.6 9-.2"/><path d="M12 9.2c0 4-3.2 6-9 5.6M12 9.2c0 4 3.2 6 9 5.6"/>',
  shoulders:'<path d="M4 16a8 8 0 0 1 16 0"/><circle cx="12" cy="8" r="2.2"/>',
  arms:'<path d="M8 4v7a4 4 0 0 0 8 0V4"/><path d="M6 4h4M14 4h4"/>',
  back:'<path d="M12 4v15"/><path d="M12 7c-2.6 0-5 1.7-7 5M12 7c2.6 0 5 1.7 7 5"/>',
  legs:'<path d="M9 4l-1 8-2 8M15 4l1 8 2 8"/><path d="M8 4h8"/>',
  core:'<path d="M7.5 5h9M7.5 10h9M7.5 15h9M12 5v13"/>',
};
const S = (i: string) => `<svg viewBox="0 0 24 24">${i}</svg>`;
const ICON: Record<string, string> = {
  swap:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  history:'<path d="M4 18l5-6 3 3 6-8"/><path d="M16 7h3v3"/>',
  tune:'<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>',
  star:'<path d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.5 6.1 20.8l1.2-6.6L2.5 9.6l6.6-.9z"/>',
  weight:'<path d="M4 9v6M7 7.5v9M17 7.5v9M20 9v6M7 12h10"/>',
  sets:'<path d="M12 3 20 7 12 11 4 7Z"/><path d="M4 12 12 16 20 12"/><path d="M4 17 12 21 20 17"/>',
  reps:'<path d="M17 3l3 3-3 3"/><path d="M20 6H9a5 5 0 0 0-5 5"/><path d="M7 21l-3-3 3-3"/><path d="M4 18h11a5 5 0 0 0 5-5"/>',
  rest:'<circle cx="12" cy="13" r="8"/><path d="M12 13V9M12 13l3 2M9 3h6"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  arrow:'<path d="M4 12h14M13 7l5 5-5 5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  check:'<path d="M5 13l4 4L19 7"/>',
  x:'<path d="M5 7l12 12M5 19l12-12"/>',
  trash:'<path d="M18 6L6 18M6 6l12 12"/>',
};

const esc = (s: string): string => String(s).replace(/[&<>"']/g, (c: string): string => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'} as Record<string,string>)[c]);
const uid = () => 'l' + Math.random().toString(36).slice(2,9);
const blankSets = (n: number) => Array.from({length:n}, () => ({ weight:null, reps:null, done:false, failed:false }));
const hist = (base: number, step: number, reps: number) => Array.from({length:6}, (_,i) => ({ w: base + i*step, r: reps }));
const pad2 = (n: number) => String(n).padStart(2, '0');
const ymdKey = (d: Date) => d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
const offsetDate = (days: number) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+days); return ymdKey(d); };
const LB = 0.45359237;
const wDisp = (kg: number, perHand: boolean, unit: string) => {
  if (unit === 'lb') return Math.round(kg / LB * 2) / 2;
  return Math.round(kg * 100) / 100;
};
const wDispU = (kg: number, perHand?: boolean, unit: string = UNIT) => wDisp(kg, !!perHand, unit);
const wKg = (v: number, unit: string) => unit === 'lb' ? Math.round(v * LB * 1000) / 1000 : v;
const uLabel = (perHand: boolean, unit: string) => unit + (perHand ? '/ea' : '');

let UNIT = 'kg';
try { const u = localStorage.getItem('vitality.logger.unit'); if (u === 'lb' || u === 'kg') UNIT = u; } catch(e){}
const setUnit = (u: string) => { if (u !== 'kg' && u !== 'lb') return; UNIT = u; try { localStorage.setItem('vitality.logger.unit', u); } catch(e){} };
const nudgeDefault = () => UNIT === 'lb' ? 5 : 2.5;
const fmtN = (n: number) => (Math.round(n * 10) / 10).toString();
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round05 = (n: number) => Math.round(n * 2) / 2;
const gradeSet = (lift: Lift, set: SetData) => {
  if (set.failed) return 'failed';
  if (!set.done) return 'empty';
  const sw = set.weight ?? 0;
  const sr = set.reps ?? 0;
  const beatWeight = sw > lift.weight;
  const beatReps = sr > lift.targetReps;
  const metWeight = sw >= lift.weight;
  const metReps = sr >= lift.targetReps;
  if (metWeight && metReps) return (beatWeight || beatReps) ? 'over' : 'clean';
  return 'partial';
};
const statusWord = (lift: Lift, set: SetData, kind: string) => {
  if (kind === 'failed') return 'missed';
  const sr = set.reps ?? 0;
  if (kind === 'over') { const d = sr - lift.targetReps; return d > 0 ? 'done · +' + d : 'done'; }
  if (kind === 'partial') { const d = sr - lift.targetReps; return d < 0 ? 'partial · ' + d : 'partial'; }
  return 'done';
};
const prevBestOf = (lift: Lift): { weight: number; reps: number } | null => {
  let best: { weight: number; reps: number } | null = null;
  (lift.history || []).forEach(s => { const w = s.w || 0, r = s.r || 0; if (!best || w > best.weight || (w === best.weight && r > best.reps)) best = { weight: w, reps: r }; });
  return best;
};
const beatsPrevBest = (lift: Lift, set: SetData): boolean => {
  const best = prevBestOf(lift);
  if (!best || best.weight <= 0) return false;
  const sw = set.weight ?? 0;
  const sr = set.reps ?? 0;
  if (sw > best.weight) return true;
  return sw === best.weight && sr > best.reps;
};
const isConquered = (lift: Lift) => {
  const rows = lift.sets || [];
  if (!rows.length) return false;
  if (!rows.every(s => s.done || s.failed)) return false;
  return rows.some(s => s.done && !s.failed && (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0 && beatsPrevBest(lift, s));
};
const isCompleted = (lift: Lift) => { const rows = lift.sets || []; return rows.length > 0 && rows.every(s => s.done && !s.failed); };
const overloadGoalMet = (lift: Lift) => {
  const b = lift.overload; if (!b) return false;
  const tW = lift.weight + (b.weightKg || 0); const tR = lift.targetReps + (b.reps || 0);
  return lift.sets.some(s => s.done && !s.failed && (s.weight ?? 0) >= tW && (s.reps ?? 0) >= tR);
};
const bumpLabel = (b: { weightKg: number; reps: number } | null, perHand: boolean) => {
  if (!b) return '';
  const parts: string[] = [];
  if ((b.weightKg || 0) > 0) parts.push('+' + fmtN(wDisp(b.weightKg, perHand, UNIT)) + ' ' + uLabel(perHand, UNIT));
  if ((b.reps || 0) > 0) parts.push('+' + b.reps + ' rep' + (b.reps > 1 ? 's' : ''));
  return parts.join(' · ') || 'no change';
};

// ---- Seed data ----
const seedLift = (n: string, t: number, m: string, w: number, r: number, rest: number, sets = 4, perHand = false, libKey?: string, overload = null as any): Lift => ({
  id: uid(), name: n, tier: t, muscle: m, libKey, perHand, targetSets: sets, targetReps: r, weight: w, rest, hidden: false, overload,
  history: hist(w, Math.max(2.5, w/8), r).map((h, i) => ({ ...h, date: offsetDate(-6 + i) })),
  sets: blankSets(sets),
});
const seedLiftWithSets = (n: string, t: number, m: string, w: number, r: number, rest: number, presets: { weight: number | null; reps: number | null; done?: boolean; failed?: boolean }[], sets = 4, perHand = false, libKey?: string, overload = null as any): Lift => {
  const l = seedLift(n, t, m, w, r, rest, sets, perHand, libKey, overload);
  l.sets = presets.map(p => ({ weight: p.weight, reps: p.reps, done: !!p.done, failed: !!p.failed }));
  return l;
};
const seedDS = (): DS => ({
  days: [
    { id:'day-push', name:'Push', lifts:[
      seedLiftWithSets('Incline DB Press', 1, 'chest', 24, 8, 120, [
        { weight: 26, reps: 8, done: true }, { weight: 26, reps: 8, done: true },
        { weight: 26, reps: 7, done: true }, { weight: null, reps: null },
      ], 4, true, 'incline_db_press', { weightKg: 2.5, reps: 1 }),
      seedLiftWithSets('Weighted Dips', 1, 'chest', 15, 8, 120, [
        { weight: 15, reps: 9, done: true, failed: true },
        { weight: 15, reps: 7, done: true, failed: true },
      ], 4, false, 'weighted_dips'),
      seedLiftWithSets('Seated DB OHP', 1, 'shoulders', 18, 10, 90, [
        { weight: 18, reps: 10, done: true }, { weight: 18, reps: 10, done: true },
        { weight: 20, reps: 8, done: true }, { weight: 20, reps: 8, done: true },
      ], 4, true, 'seated_db_ohp', { weightKg: 2.5, reps: 1 }),
      seedLiftWithSets('Cable Triceps', 2, 'arms', 22.5, 12, 75, [
        { weight: 22.5, reps: 12, done: true }, { weight: 22.5, reps: 12, done: true },
        { weight: 25, reps: 10, done: true },
      ], 3, false, 'cable_triceps_pushdown'),
    ]},
    { id:'day-pull', name:'Pull', lifts:[
      seedLiftWithSets('Weighted Pull-Ups', 1, 'back', 12, 8, 120, [
        { weight: 12, reps: 8, done: true }, { weight: 12, reps: 7, done: true },
      ], 4, false, 'weighted_pullups'),
      seedLiftWithSets('Pendlay Row', 1, 'back', 80, 6, 120, [
        { weight: 80, reps: 6, done: true }, { weight: 80, reps: 6, done: true },
        { weight: 80, reps: 5, done: true }, { weight: 82.5, reps: 5, done: true },
      ], 4, false, 'pendlay_row', { weightKg: 2.5, reps: 0 }),
      seedLiftWithSets('DB Curl', 2, 'arms', 14, 10, 75, [
        { weight: 14, reps: 10, done: true },
      ], 3, true, 'db_curl'),
    ]},
    { id:'day-legs', name:'Legs', lifts:[
      seedLiftWithSets('Back Squat', 1, 'legs', 100, 5, 180, [
        { weight: 100, reps: 5, done: true }, { weight: 100, reps: 5, done: true },
        { weight: 100, reps: 5, done: true }, { weight: 100, reps: 4, done: true, failed: true },
      ], 4, false, 'back_squat', { weightKg: 2.5, reps: 0 }),
      seedLiftWithSets('Romanian DL', 1, 'legs', 90, 8, 150, [
        { weight: 90, reps: 8, done: true },
      ], 4, false, 'romanian_dl'),
    ]},
  ],
  activeDayId: 'day-push',
});

// ---- Library catalog ----
type LibEntry = { key: string; name: string; muscle: 'chest'|'shoulders'|'arms'|'back'|'legs'|'core'; tier: 1|2|3; perHand?: boolean; defaultSets?: number; defaultReps?: number; defaultWeight?: number; rest?: number; overload?: { weightKg: number; reps: number } | null };
const LIBRARY: LibEntry[] = [
  { key:'barbell_bench', name:'Barbell Bench Press', muscle:'chest', tier:1, defaultSets:4, defaultReps:5, defaultWeight:70, rest:150 },
  { key:'incline_bb_bench', name:'Incline Barbell Bench', muscle:'chest', tier:1, defaultSets:4, defaultReps:6, defaultWeight:60, rest:150 },
  { key:'incline_db_press', name:'Incline DB Press', muscle:'chest', tier:1, perHand:true, defaultSets:4, defaultReps:8, defaultWeight:24, rest:120, overload:{ weightKg:2.5, reps:1 } },
  { key:'weighted_dips', name:'Weighted Dips', muscle:'chest', tier:1, defaultSets:4, defaultReps:8, defaultWeight:15, rest:120 },
  { key:'cable_fly', name:'Cable Fly', muscle:'chest', tier:2, defaultSets:3, defaultReps:12, defaultWeight:18, rest:75 },
  { key:'push_up', name:'Push-Up', muscle:'chest', tier:3, defaultSets:3, defaultReps:15, defaultWeight:0, rest:60 },
  { key:'barbell_ohp', name:'Standing OHP', muscle:'shoulders', tier:1, defaultSets:4, defaultReps:5, defaultWeight:45, rest:150 },
  { key:'seated_db_ohp', name:'Seated DB OHP', muscle:'shoulders', tier:1, perHand:true, defaultSets:4, defaultReps:8, defaultWeight:18, rest:120, overload:{ weightKg:2.5, reps:1 } },
  { key:'db_lateral_raise', name:'DB Lateral Raise', muscle:'shoulders', tier:2, perHand:true, defaultSets:4, defaultReps:12, defaultWeight:8, rest:60 },
  { key:'cable_lateral_raise', name:'Cable Lateral Raise', muscle:'shoulders', tier:2, perHand:true, defaultSets:3, defaultReps:15, defaultWeight:6, rest:60 },
  { key:'face_pull', name:'Face Pull', muscle:'shoulders', tier:2, defaultSets:3, defaultReps:15, defaultWeight:18, rest:60 },
  { key:'barbell_curl', name:'Barbell Curl', muscle:'arms', tier:2, defaultSets:3, defaultReps:8, defaultWeight:35, rest:75 },
  { key:'db_curl', name:'DB Curl', muscle:'arms', tier:2, perHand:true, defaultSets:3, defaultReps:10, defaultWeight:14, rest:75 },
  { key:'hammer_curl', name:'Hammer Curl', muscle:'arms', tier:2, perHand:true, defaultSets:3, defaultReps:10, defaultWeight:12, rest:60 },
  { key:'cable_triceps_pushdown', name:'Triceps Pushdown', muscle:'arms', tier:2, defaultSets:3, defaultReps:12, defaultWeight:22.5, rest:60 },
  { key:'overhead_triceps', name:'Overhead Triceps Ext.', muscle:'arms', tier:2, perHand:true, defaultSets:3, defaultReps:12, defaultWeight:14, rest:75 },
  { key:'weighted_pullups', name:'Weighted Pull-Ups', muscle:'back', tier:1, defaultSets:4, defaultReps:6, defaultWeight:10, rest:150 },
  { key:'pendlay_row', name:'Pendlay Row', muscle:'back', tier:1, defaultSets:4, defaultReps:6, defaultWeight:80, rest:150, overload:{ weightKg:2.5, reps:0 } },
  { key:'seated_row', name:'Seated Cable Row', muscle:'back', tier:1, defaultSets:4, defaultReps:8, defaultWeight:65, rest:120 },
  { key:'lat_pulldown', name:'Lat Pulldown', muscle:'back', tier:2, defaultSets:3, defaultReps:10, defaultWeight:60, rest:90 },
  { key:'back_squat', name:'Back Squat', muscle:'legs', tier:1, defaultSets:4, defaultReps:5, defaultWeight:100, rest:180, overload:{ weightKg:2.5, reps:0 } },
  { key:'front_squat', name:'Front Squat', muscle:'legs', tier:1, defaultSets:4, defaultReps:5, defaultWeight:80, rest:180 },
  { key:'romanian_dl', name:'Romanian Deadlift', muscle:'legs', tier:1, defaultSets:4, defaultReps:8, defaultWeight:90, rest:150 },
  { key:'hip_thrust', name:'Barbell Hip Thrust', muscle:'legs', tier:1, defaultSets:4, defaultReps:8, defaultWeight:100, rest:150 },
  { key:'walking_lunge', name:'Walking Lunge', muscle:'legs', tier:2, perHand:true, defaultSets:3, defaultReps:10, defaultWeight:16, rest:90 },
  { key:'leg_press', name:'Leg Press', muscle:'legs', tier:2, defaultSets:3, defaultReps:12, defaultWeight:160, rest:120 },
  { key:'leg_curl', name:'Lying Leg Curl', muscle:'legs', tier:2, defaultSets:3, defaultReps:10, defaultWeight:40, rest:90 },
  { key:'standing_calf', name:'Standing Calf Raise', muscle:'legs', tier:2, defaultSets:4, defaultReps:12, defaultWeight:80, rest:60 },
  { key:'hanging_leg_raise', name:'Hanging Leg Raise', muscle:'core', tier:2, defaultSets:3, defaultReps:12, defaultWeight:0, rest:60 },
  { key:'cable_crunch', name:'Cable Crunch', muscle:'core', tier:2, defaultSets:3, defaultReps:15, defaultWeight:25, rest:60 },
];
const libByKey = (k: string) => LIBRARY.find(x => x.key === k);
const libMatches = (lift: Lift) => {
  if (lift.libKey) return libByKey(lift.libKey);
  return LIBRARY.find(x => x.name.toLowerCase() === lift.name.toLowerCase());
};
const matchKeys = (lifts: Lift[]) => {
  const out: string[] = [];
  lifts.forEach(l => { const m = libMatches(l); if (m && out.indexOf(m.key) === -1) out.push(m.key); });
  return out;
};
const remainingChips = (lifts: Lift[]) => {
  const used = new Set(matchKeys(lifts));
  return LIBRARY.filter(x => !used.has(x.key));
};

// ---- Main component ----
export default function TrainLogger() {
  const [ds, setDS] = useState<DS>(seedDS);
  const [tab, setTab] = useState<'lift'|'log'>('lift');
  const [newLiftKey, setNewLiftKey] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [historyTab, setHistoryTab] = useState<'all'|'prs'>('all');
  const [historyFilter, setHistoryFilter] = useState<string>('');
  const [timer, setTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef<number>(0);
  const [toast, setToast] = useState<{msg:string; type:'success'|'error'} | null>(null);
  const toastRef = useRef<{msg:string; type:'success'|'error'} | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDay = () => ds.days.find(d => d.id === ds.activeDayId);
  const activeLifts = () => activeDay()?.lifts || [];

  const save = () => {
    try { localStorage.setItem('imperium.trainLogger', JSON.stringify(ds)); }
    catch (e) { console.warn('Save failed:', e); }
  };
  const load = () => {
    try {
      const raw = localStorage.getItem('imperium.trainLogger');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.days && Array.isArray(parsed.days)) {
          setDS(parsed as DS);
        }
      }
    } catch (e) {
      console.warn('Load failed:', e);
    }
  };
  useEffect(() => { load(); }, []);

  // ---- Actions ----
  const toggleDone = useCallback((lid: string, sid: number) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      const sets = [...lift.sets];
      const old = sets[sid];
      sets[sid] = { ...old, done: !old.done };
      lift.sets = sets;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const toggleFail = useCallback((lid: string, sid: number) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      const sets = [...lift.sets];
      const old = sets[sid];
      sets[sid] = { ...old, failed: !old.failed };
      lift.sets = sets;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const updateWeight = useCallback((lid: string, sid: number, v: number | null) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      const sets = [...lift.sets];
      sets[sid] = { ...sets[sid], weight: v };
      lift.sets = sets;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const updateReps = useCallback((lid: string, sid: number, v: number | null) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      const sets = [...lift.sets];
      sets[sid] = { ...sets[sid], reps: v };
      lift.sets = sets;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const addSet = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      const sets = [...lift.sets, { weight: null, reps: null, done: false, failed: false }];
      lift.sets = sets;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const removeSet = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift || lift.sets.length <= 1) return prev;
      const sets = lift.sets.slice(0, -1);
      lift.sets = sets;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const liftWeight = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      const nudge = nudgeDefault();
      lift.weight = Math.round((lift.weight + nudge) * 2) / 2;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const liftReps = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      lift.targetReps += 1;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const liftRest = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      lift.rest = (lift.rest || 0) + 15;
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const liftSets = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      lift.targetSets += 1;
      lift.sets = [...lift.sets, { weight: null, reps: null, done: false, failed: false }];
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const lowerWeight = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      const nudge = nudgeDefault();
      lift.weight = Math.max(0, Math.round((lift.weight - nudge) * 2) / 2);
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const lowerReps = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      lift.targetReps = Math.max(1, lift.targetReps - 1);
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const lowerRest = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift) return prev;
      lift.rest = Math.max(0, (lift.rest || 0) - 15);
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const lowerSets = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const lift = day.lifts.find(l => l.id === lid);
      if (!lift || lift.targetSets <= 1) return prev;
      lift.targetSets -= 1;
      if (lift.sets.length > lift.targetSets) {
        lift.sets = lift.sets.slice(0, lift.targetSets);
      }
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timeLeftRef.current = seconds;
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, 1000);
  }, []);

  const skipTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      timeLeftRef.current = 0;
      setTimeLeft(0);
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timeLeftRef.current = 0;
    setTimeLeft(0);
  }, []);

  const addLiftFromLib = useCallback((key: string) => {
    const lib = libByKey(key);
    if (!lib) return;
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const exists = day.lifts.some(l => l.libKey === key);
      if (exists) return prev;
      const lift = seedLift(lib.name, lib.tier, lib.muscle, lib.defaultWeight || 0, lib.defaultReps || 0, lib.rest || 0, lib.defaultSets || 3, lib.perHand || false, key, lib.overload || null);
      day.lifts.push(lift);
      save();
      return { ...prev, days: [...prev.days] };
    });
    setNewLiftKey('');
    setShowAddDialog(false);
  }, []);

  const removeLift = useCallback((lid: string) => {
    setDS(prev => {
      const day = prev.days.find(d => d.id === prev.activeDayId);
      if (!day) return prev;
      const idx = day.lifts.findIndex(l => l.id === lid);
      if (idx === -1) return prev;
      day.lifts.splice(idx, 1);
      save();
      return { ...prev, days: [...prev.days] };
    });
  }, []);

  const setActiveDay = useCallback((id: string) => {
    setDS(prev => ({ ...prev, activeDayId: id }));
    save();
  }, []);

  const exportData = useCallback(() => {
    try {
      const data = JSON.stringify(ds, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imperium-trainlog-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: 'Exported', type: 'success' });
    } catch (e) {
      setToast({ msg: 'Export failed', type: 'error' });
    }
  }, []);

  const importData = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.days && Array.isArray(parsed.days)) {
          setDS(parsed as DS);
          save();
          setToast({ msg: 'Imported', type: 'success' });
        } else {
          setToast({ msg: 'Invalid data', type: 'error' });
        }
      } catch (err) {
        setToast({ msg: 'Parse error', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const clearData = useCallback(() => {
    if (window.confirm('Reset all data to seed?')) {
      setDS(seedDS());
      save();
      setToast({ msg: 'Reset to seed', type: 'success' });
    }
  }, []);

  const toggleUnit = useCallback(() => {
    setUnit(UNIT === 'kg' ? 'lb' : 'kg');
    setToast({ msg: `Unit: ${UNIT === 'kg' ? 'lb' : 'kg'}`, type: 'success' });
  }, []);

  // ---- Derived ----
  const dayList = useMemo(() => ds.days, [ds.days]);
  const filteredChips = useMemo(() => {
    const term = filter.toLowerCase().trim();
    return remainingChips(activeLifts()).filter(chip =>
      chip.name.toLowerCase().includes(term)
    );
  }, [filter, activeLifts]);
  const historyList = useMemo(() => {
    const term = historyFilter.toLowerCase().trim();
    const all: { date:string; lift:string; w:number; r:number }[] = [];
    ds.days.forEach(d => {
      d.lifts.forEach(l => {
        (l.history || []).forEach(h => {
          all.push({ date:h.date, lift:l.name, w:h.w, r:h.r });
        });
      });
    });
    const filtered = all.filter(item =>
      item.lift.toLowerCase().includes(term)
    );
    if (historyTab === 'prs') {
      const best: Record<string, { w:number; r:number; date:string }> = {};
      filtered.forEach(item => {
        const key = item.lift;
        if (!best[key] || item.w > best[key].w || (item.w === best[key].w && item.r > best[key].r)) {
          best[key] = item;
        }
      });
      return Object.entries(best).map(([lift, {w, r, date}]) => ({ date, lift, w, r }));
    }
    return filtered;
  }, [historyFilter, historyTab, ds]);

  // ---- Toast handling ----
  useEffect(() => {
    if (toast) {
      toastRef.current = toast;
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => {
        setToast(null);
        toastRef.current = null;
      }, 3000);
    }
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, [toast]);

  // ---- Render helpers ----
  const formatWeight = (kg: number | null) => {
    if (kg === null) return '--';
    return wDisp(kg, false, UNIT).toString();
  };
  const formatReps = (reps: number | null) => reps === null ? '--' : reps.toString();
  const formatRest = (sec: number | null) => {
    if (sec === null) return '--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ---- Main render ----
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">
            Train Logger
          </h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleUnit}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Unit: {UNIT.toUpperCase()}
            </button>
            <button
              onClick={exportData}
              className="px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-100"
            >
              Export
            </button>
            <input
              type="file"
              accept=".json"
              onChange={importData}
              className="hidden"
            />
            <button
              onClick={() => document.getElementById('import-file')?.click()}
              className="px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-100"
            >
              Import
            </button>
            <button
              onClick={clearData}
              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <button
            className={`
              px-4 py-2 text-sm font-medium
              ${tab === 'lift' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}
            `}
            onClick={() => setTab('lift')}
          >
            Lift Builder
          </button>
          <button
            className={`
              px-4 py-2 text-sm font-medium
              ${tab === 'log' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}
            `}
            onClick={() => setTab('log')}
          >
            Workout Log
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 p-4 rounded-lg ${toast.type === 'success' ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'}`}
          >
            {toast.msg}
          </div>
        )}

        {/* Tab Content */}
        {tab === 'lift' ? (
          <>
            {/* Day selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Active Day
              </label>
              <div className="flex flex-wrap gap-2">
                {dayList.map((day: Day) => (
                  <button
                    key={day.id}
                    onClick={() => setActiveDay(day.id)}
                    className={`
                      px-3 py-1.5 text-sm font-medium rounded
                      ${ds.activeDayId === day.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                    `}
                  >
                    {day.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Add */}
            <div className="mb-6">
              <div className="flex mb-4">
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter exercises…"
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setShowAddDialog(true)}
                  className="ml-3 px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  + Add Exercise
                </button>
              </div>
              {showAddDialog && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Add Exercise</h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={newLiftKey}
                      onChange={(e) => setNewLiftKey(e.target.value)}
                      placeholder="Search or type exercise name…"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="max-h-60 overflow-y-auto border rounded">
                      {filteredChips.map((chip: typeof LIBRARY[number]) => (
                        <div
                          key={chip.key}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-50"
                          onClick={() => addLiftFromLib(chip.key)}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-0.5">
                              <span className="text-xs px-1.5 py-0.5 rounded text-indigo-600 bg-indigo-50">
                                Tier {chip.tier}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{chip.name}</p>
                              <p className="text-xs text-gray-500">{chip.muscle}</p>
                              {chip.overload && (
                                <p className="text-xs text-indigo-600 font-medium">
                                  Overload: +{fmtN(wDisp(chip.overload.weightKg, chip.perHand || false, UNIT))} {uLabel(chip.perHand || false, UNIT)} ·
                                  +{chip.overload.reps} rep{chip.overload.reps > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {!filteredChips.length && filter && (
                        <div className="px-3 py-2 text-center text-gray-500">
                          No matches
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowAddDialog(false)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Lifts grid */}
            <div className="space-y-6">
              {activeLifts().map(lift => (
                <div key={lift.id} className="bg-white rounded-lg shadow">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded text-indigo-600 bg-indigo-50">
                          Tier {lift.tier}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{lift.name}</p>
                        <p className="text-xs text-gray-500">{lift.muscle}</p>
                        {lift.overload && (
                          <p className="text-xs text-indigo-600 font-medium">
                            Overload: +{fmtN(wDisp(lift.overload.weightKg, !!lift.perHand, UNIT))} {uLabel(!!lift.perHand, UNIT)} ·
                            +{lift.overload.reps} rep{lift.overload.reps > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <button
                        onClick={() => liftWeight(lift.id)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Increase weight"
                      >
                        {S(ICON.weight)}
                      </button>
                      <button
                        onClick={() => lowerWeight(lift.id)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Decrease weight"
                      >
                        <svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>
                      </button>
                      <button
                        onClick={() => liftReps(lift.id)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Increase reps"
                      >
                        {S(ICON.reps)}
                      </button>
                      <button
                        onClick={() => lowerReps(lift.id)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Decrease reps"
                      >
                        <svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>
                      </button>
                      <button
                        onClick={() => liftRest(lift.id)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Increase rest"
                      >
                        {S(ICON.rest)}
                      </button>
                      <button
                        onClick={() => lowerRest(lift.id)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Decrease rest"
                      >
                        <svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>
                      </button>
                      <button
                        onClick={() => liftSets(lift.id)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Add set"
                      >
                        {S(ICON.sets)}
                      </button>
                      <button
                        onClick={() => removeSet(lift.id)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Remove set"
                      >
                        {S(ICON.trash || '')}
                      </button>
                    </div>
                  </div>

                  {/* Sets table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Set</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Weight</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reps</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {lift.sets.map((set, idx) => {
                          const status = gradeSet(lift, set);
                          const isBest = beatsPrevBest(lift, set);
                          return (
                            <tr
                              key={idx}
                              className={`
                                ${status === 'failed' ? 'bg-red-50' : ''}
                                ${status === 'over' ? 'bg-green-50' : ''}
                                ${isBest ? 'border-l-4 border-indigo-500' : ''}
                              `}
                            >
                              <td className="px-3 py-2 text-sm font-medium text-gray-700">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2 text-sm font-medium">
                                <input
                                  type="number"
                                  min="0"
                                  step={UNIT === 'lb' ? '2.5' : '0.1'}
                                  value={set.weight ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? null : parseFloat(e.target.value);
                                    updateWeight(lift.id, idx, v);
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  placeholder="--"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm font-medium">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={set.reps ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                    updateReps(lift.id, idx, v);
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  placeholder="--"
                                />
                              </td>
                              <td className="px-3 py-2 text-center space-x-1">
                                <button
                                  onClick={() => toggleDone(lift.id, idx)}
                                  className={`
                                    p-1 rounded
                                    ${set.done ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}
                                  `}
                                  title="Mark done"
                                >
                                  {S(ICON.check || '')}
                                </button>
                                <button
                                  onClick={() => toggleFail(lift.id, idx)}
                                  className={`
                                    p-1 rounded ml-1
                                    ${set.failed ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}
                                  `}
                                  title="Mark failed"
                                >
                                  {S(ICON.x || '')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Lift footer */}
                  <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => removeLift(lift.id)}
                        className="w-full px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
                      >
                        Remove Exercise
                      </button>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      {isCompleted(lift) && (
                        <span className="text-xs text-green-600">Completed</span>
                      )}
                      {isConquered(lift) && (
                        <span className="text-xs text-indigo-600 font-medium ml-2">Conquered!</span>
                      )}
                      {overloadGoalMet(lift) && (
                        <span className="text-xs text-indigo-600 font-medium ml-2">Overload Met!</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!activeLifts().length && (
                <div className="text-center py-8 text-gray-500">
                  No exercises added yet. Use the search above to add exercises to your workout.
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Log Tab Content */}
            <div className="space-y-6">
              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-gray-700">View:</label>
                  <button
                    onClick={() => setHistoryTab('all')}
                    className={`
                      px-3 py-1.5 text-sm font-medium
                      ${historyTab === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                    `}
                  >
                    All Sets
                  </button>
                  <button
                    onClick={() => setHistoryTab('prs')}
                    className={`
                      px-3 py-1.5 text-sm font-medium
                      ${historyTab === 'prs' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                    `}
                  >
                    Personal Records
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                    placeholder="Filter exercises…"
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* History table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Exercise</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Weight</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {historyList.map((item: { date: string; lift: string; w: number; r: number }, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-700">{item.date}</td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.lift}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{formatWeight(item.w)} {UNIT.toUpperCase()}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{item.r}</td>
                      </tr>
                    ))}
                    {!historyList.length && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                          No history data yet. Complete workouts to see your progress here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
