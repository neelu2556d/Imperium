"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { PlusIcon, TrashIcon, GearIcon, RefreshIcon, ChevronIcon, StarIcon } from "@/components/train/icons";
import { getTrainSettings, saveTrainSettings } from "@/lib/train/settings";

// ============================================================
// Types
// ============================================================

type WeightUnit = "kg" | "lbs";

interface HistoryEntry {
  w: number;
  r: number;
  date: string;
  sets: { r: number; fail: boolean }[];
}

interface SetEntry {
  weight: number;
  reps: number;
  done: boolean;
  failed: boolean;
}

interface Lift {
  id: string;
  name: string;
  tier: "primary" | "secondary" | "accessory";
  muscle: string;
  targetSets: number;
  targetReps: number;
  weight: number;
  rest: number;
  history: HistoryEntry[];
  sets: SetEntry[];
  hidden: boolean;
  overload: { w: number; r: number }[];
  stars: number;
}

interface Day {
  id: string;
  name: string;
  lifts: Lift[];
}

interface AppState {
  days: Day[];
  activeDayId: string | null;
  kgMode: boolean;
  showSettings: boolean;
  showLibrary: boolean;
  showChart: boolean;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_DAYS: Day[] = [
  { id: "push", name: "Push", lifts: [] },
  { id: "pull", name: "Pull", lifts: [] },
  { id: "legs", name: "Legs", lifts: [] },
  { id: "rest", name: "Rest", lifts: [] },
];

const STORAGE_KEY = "imperium.train.logger";
const MUSCLE_ICONS: Record<string, string> = {
  chest: "💪",
  back: "🔙",
  shoulders: "🎯",
  biceps: "💪",
  triceps: "💪",
  legs: "🦵",
  core: "🎯",
  glutes: "🦵",
};

const MUSCLE_COLORS: Record<string, string> = {
  chest: "#FF6B6B",
  back: "#4ECDC4",
  shoulders: "#FFE66D",
  biceps: "#95E1D3",
  triceps: "#F38181",
  legs: "#AA96DA",
  core: "#FCBAD3",
  glutes: "#A8D8EA",
};

// ============================================================
// Utility Functions
// ============================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function kgToDisplay(kg: number, unit: WeightUnit): number {
  if (unit === "lbs") return Math.round(kg * 2.20462 * 10) / 10;
  return Math.round(kg * 10) / 10;
}

function displayToKg(value: number, unit: WeightUnit): number {
  if (unit === "lbs") return value / 2.20462;
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function loadState(): AppState {
  if (typeof window === "undefined") {
    return { days: DEFAULT_DAYS, activeDayId: null, kgMode: true, showSettings: false, showLibrary: false, showChart: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { days: DEFAULT_DAYS, activeDayId: null, kgMode: true, showSettings: false, showLibrary: false, showChart: false };
    const parsed = JSON.parse(raw);
    return {
      days: parsed.days || DEFAULT_DAYS,
      activeDayId: parsed.activeDayId || null,
      kgMode: parsed.kgMode ?? true,
      showSettings: false,
      showLibrary: false,
      showChart: false,
    };
  } catch {
    return { days: DEFAULT_DAYS, activeDayId: null, kgMode: true, showSettings: false, showLibrary: false, showChart: false };
  }
}

function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      days: state.days,
      activeDayId: state.activeDayId,
      kgMode: state.kgMode,
    }));
  } catch {
    // ignore
  }
}

// ============================================================
// Sub-components
// ============================================================

interface LiftCardProps {
  lift: Lift;
  unit: WeightUnit;
  onSetChange: (liftId: string, sets: SetEntry[]) => void;
  onToggleHidden: (liftId: string) => void;
  onDelete: (liftId: string) => void;
  onAddSet: (liftId: string) => void;
  onRemoveSet: (liftId: string, setIndex: number) => void;
  onStar: (liftId: string) => void;
  showChart: (liftId: string) => void;
}

function LiftCard({ lift, unit, onSetChange, onToggleHidden, onDelete, onAddSet, onRemoveSet, onStar, showChart }: LiftCardProps) {
  const muscleColor = MUSCLE_COLORS[lift.muscle] || "#888";
  const muscleIcon = MUSCLE_ICONS[lift.muscle] || "💪";

  const handleSetToggle = (index: number, done: boolean) => {
    const newSets = [...lift.sets];
    newSets[index] = { ...newSets[index], done };
    onSetChange(lift.id, newSets);
  };

  const handleSetInput = (index: number, field: "weight" | "reps", value: number) => {
    const newSets = [...lift.sets];
    newSets[index] = { ...newSets[index], [field]: value };
    onSetChange(lift.id, newSets);
  };

  const handleSetFail = (index: number) => {
    const newSets = [...lift.sets];
    newSets[index] = { ...newSets[index], failed: !newSets[index].failed };
    onSetChange(lift.id, newSets);
  };

  const completedSets = lift.sets.filter((s) => s.done).length;
  const progress = lift.targetSets > 0 ? (completedSets / lift.targetSets) * 100 : 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden mb-3" style={{ borderLeft: `4px solid ${muscleColor}` }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">{muscleIcon}</span>
          <div>
            <h3 className="font-semibold text-sm">{lift.name}</h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="capitalize">{lift.muscle}</span>
              <span>•</span>
              <span>{lift.targetSets}×{lift.targetReps}</span>
              {lift.sets.length > 0 && (
                <>
                  <span>•</span>
                  <span className={completedSets === lift.targetSets ? "text-green-600" : ""}>
                    {completedSets}/{lift.targetSets}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStar(lift.id)}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="Progressive overload"
          >
            <StarIcon size={16} filled={lift.stars > 0} className={lift.stars > 0 ? "text-yellow-500" : ""} />
          </button>
          <button
            onClick={() => showChart(lift.id)}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="View history"
          >
            <RefreshIcon size={16} />
          </button>
          <button
            onClick={() => onToggleHidden(lift.id)}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title={lift.hidden ? "Show" : "Hide"}
          >
            <ChevronIcon size={16} className={lift.hidden ? "rotate-180" : ""} />
          </button>
          <button
            onClick={() => onDelete(lift.id)}
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
            title="Remove exercise"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: muscleColor }}
        />
      </div>

      {/* Sets */}
      {!lift.hidden && (
        <div className="p-3 space-y-2">
          {lift.sets.map((set, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-xs text-zinc-400 text-center">
                {i + 1}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={set.weight}
                onChange={(e) => handleSetInput(i, "weight", parseFloat(e.target.value) || 0)}
                className="flex-1 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center text-sm tabular-nums"
                placeholder={String(lift.weight)}
              />
              <span className="text-xs text-zinc-400">×</span>
              <input
                type="number"
                inputMode="numeric"
                value={set.reps}
                onChange={(e) => handleSetInput(i, "reps", parseInt(e.target.value) || 0)}
                className="w-14 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center text-sm"
                placeholder={String(lift.targetReps)}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => handleSetToggle(i, !set.done)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    set.done
                      ? "bg-green-500 text-white"
                      : "bg-zinc-100 dark:bg-zinc-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                  }`}
                >
                  {set.done ? "✓" : "Hit"}
                </button>
                {set.done && (
                  <button
                    onClick={() => handleSetFail(i)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      set.failed
                        ? "bg-red-500 text-white"
                        : "bg-zinc-100 dark:bg-zinc-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                    }`}
                  >
                    Fail
                  </button>
                )}
              </div>
              {lift.sets.length > 1 && (
                <button
                  onClick={() => onRemoveSet(lift.id, i)}
                  className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <TrashIcon size={14} />
                </button>
              )}
            </div>
          ))}

          {/* Add set button */}
          <button
            onClick={() => onAddSet(lift.id)}
            className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-600 transition-colors flex items-center justify-center gap-1"
          >
            <PlusIcon size={14} /> Add Set
          </button>

          {/* Progressive overload suggestion */}
          {lift.stars > 0 && lift.sets.length > 0 && lift.sets.every((s) => s.done) && (
            <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-1">
                <StarIcon size={14} filled className="text-yellow-500" />
                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Progressive Overload</span>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-500">
                Try {lift.weight + (lift.stars >= 2 ? 2.5 : 1.25)}×{lift.targetReps} next time!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DayBoardProps {
  days: Day[];
  activeDayId: string | null;
  onSelectDay: (dayId: string) => void;
  onRenameDay: (dayId: string, name: string) => void;
  onRemoveDay: (dayId: string) => void;
  onAddDay: () => void;
}

function DayBoard({ days, activeDayId, onSelectDay, onRenameDay, onRemoveDay, onAddDay }: DayBoardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleStartEdit = (day: Day) => {
    setEditingId(day.id);
    setEditName(day.name);
  };

  const handleFinishEdit = (dayId: string) => {
    if (editName.trim()) onRenameDay(dayId, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {days.map((day) => {
        const isActive = day.id === activeDayId;
        const totalSets = day.lifts.reduce((sum, l) => sum + l.sets.filter((s) => s.done).length, 0);
        const totalTarget = day.lifts.reduce((sum, l) => sum + l.targetSets, 0);
        const isRest = day.name.toLowerCase() === "rest";

        return (
          <button
            key={day.id}
            onClick={() => onSelectDay(day.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl transition-all ${
              isActive
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg"
                : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {editingId === day.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleFinishEdit(day.id)}
                onKeyDown={(e) => e.key === "Enter" && handleFinishEdit(day.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-20 px-1 py-0.5 text-sm rounded bg-white dark:bg-zinc-900 text-center"
                autoFocus
              />
            ) : (
              <div className="text-center" onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(day); }}>
                <div className="text-sm font-medium">{day.name}</div>
                {!isRest && totalSets > 0 && (
                  <div className="text-xs opacity-70">{totalSets}/{totalTarget}</div>
                )}
              </div>
            )}
          </button>
        );
      })}
      <button
        onClick={onAddDay}
        className="flex-shrink-0 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-dashed border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 transition-colors"
      >
        <PlusIcon size={16} />
      </button>
      {days.length > 1 && activeDayId && (
        <button
          onClick={() => onRemoveDay(activeDayId)}
          className="flex-shrink-0 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <TrashIcon size={16} />
        </button>
      )}
    </div>
  );
}

interface ExerciseLibraryProps {
  onSelect: (exercise: { name: string; muscle: string; tier: "primary" | "secondary" | "accessory" }) => void;
  onClose: () => void;
}

const EXERCISES = [
  // Push - Chest
  { name: "Bench Press", muscle: "chest", tier: "primary" as const },
  { name: "Incline Bench Press", muscle: "chest", tier: "primary" as const },
  { name: "Decline Bench Press", muscle: "chest", tier: "secondary" as const },
  { name: "Dumbbell Bench Press", muscle: "chest", tier: "primary" as const },
  { name: "Incline Dumbbell Press", muscle: "chest", tier: "primary" as const },
  { name: "Dumbbell Fly", muscle: "chest", tier: "accessory" as const },
  { name: "Cable Fly", muscle: "chest", tier: "accessory" as const },
  { name: "Push-Up", muscle: "chest", tier: "accessory" as const },
  { name: "Chest Dip", muscle: "chest", tier: "secondary" as const },
  // Push - Shoulders
  { name: "Overhead Press", muscle: "shoulders", tier: "primary" as const },
  { name: "Dumbbell Shoulder Press", muscle: "shoulders", tier: "primary" as const },
  { name: "Lateral Raise", muscle: "shoulders", tier: "accessory" as const },
  { name: "Front Raise", muscle: "shoulders", tier: "accessory" as const },
  { name: "Face Pull", muscle: "shoulders", tier: "accessory" as const },
  { name: "Arnold Press", muscle: "shoulders", tier: "secondary" as const },
  // Push - Triceps
  { name: "Close Grip Bench Press", muscle: "triceps", tier: "primary" as const },
  { name: "Tricep Pushdown", muscle: "triceps", tier: "accessory" as const },
  { name: "Skull Crusher", muscle: "triceps", tier: "secondary" as const },
  { name: "Overhead Tricep Extension", muscle: "triceps", tier: "accessory" as const },
  { name: "Tricep Dip", muscle: "triceps", tier: "secondary" as const },
  // Pull - Back
  { name: "Deadlift", muscle: "back", tier: "primary" as const },
  { name: "Pull-Up", muscle: "back", tier: "primary" as const },
  { name: "Chin-Up", muscle: "back", tier: "primary" as const },
  { name: "Barbell Row", muscle: "back", tier: "primary" as const },
  { name: "Dumbbell Row", muscle: "back", tier: "primary" as const },
  { name: "T-Bar Row", muscle: "back", tier: "secondary" as const },
  { name: "Seated Cable Row", muscle: "back", tier: "secondary" as const },
  { name: "Lat Pulldown", muscle: "back", tier: "primary" as const },
  { name: "Straight Arm Pulldown", muscle: "back", tier: "accessory" as const },
  { name: "Rack Pull", muscle: "back", tier: "secondary" as const },
  { name: "Good Morning", muscle: "back", tier: "accessory" as const },
  // Pull - Biceps
  { name: "Barbell Curl", muscle: "biceps", tier: "primary" as const },
  { name: "Dumbbell Curl", muscle: "biceps", tier: "primary" as const },
  { name: "Hammer Curl", muscle: "biceps", tier: "secondary" as const },
  { name: "Preacher Curl", muscle: "biceps", tier: "accessory" as const },
  { name: "Incline Dumbbell Curl", muscle: "biceps", tier: "accessory" as const },
  { name: "Cable Curl", muscle: "biceps", tier: "accessory" as const },
  { name: "Concentration Curl", muscle: "biceps", tier: "accessory" as const },
  // Legs
  { name: "Squat", muscle: "legs", tier: "primary" as const },
  { name: "Front Squat", muscle: "legs", tier: "primary" as const },
  { name: "Leg Press", muscle: "legs", tier: "primary" as const },
  { name: "Romanian Deadlift", muscle: "legs", tier: "primary" as const },
  { name: "Leg Curl", muscle: "legs", tier: "accessory" as const },
  { name: "Leg Extension", muscle: "legs", tier: "accessory" as const },
  { name: "Lunges", muscle: "legs", tier: "secondary" as const },
  { name: "Bulgarian Split Squat", muscle: "legs", tier: "secondary" as const },
  { name: "Calf Raise", muscle: "legs", tier: "accessory" as const },
  { name: "Hip Thrust", muscle: "glutes", tier: "primary" as const },
  { name: "Glute Bridge", muscle: "glutes", tier: "accessory" as const },
  // Core
  { name: "Plank", muscle: "core", tier: "accessory" as const },
  { name: "Ab Rollout", muscle: "core", tier: "accessory" as const },
  { name: "Cable Crunch", muscle: "core", tier: "accessory" as const },
  { name: "Hanging Leg Raise", muscle: "core", tier: "accessory" as const },
  { name: "Russian Twist", muscle: "core", tier: "accessory" as const },
];

function ExerciseLibrary({ onSelect, onClose }: ExerciseLibraryProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const muscles = [...new Set(EXERCISES.map((e) => e.muscle))];

  const filtered = EXERCISES.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filter || e.muscle === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Exercise Library</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <span className="text-xl">×</span>
            </button>
          </div>
          <input
            type="search"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
          />
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <button
              onClick={() => setFilter(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                !filter ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              All
            </button>
            {muscles.map((m) => (
              <button
                key={m}
                onClick={() => setFilter(m)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === m ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtered.map((exercise) => (
            <button
              key={exercise.name}
              onClick={() => onSelect(exercise)}
              className="w-full p-3 rounded-xl text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3"
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ backgroundColor: MUSCLE_COLORS[exercise.muscle] + "20", color: MUSCLE_COLORS[exercise.muscle] }}
              >
                {MUSCLE_ICONS[exercise.muscle]}
              </span>
              <div className="flex-1">
                <div className="font-medium text-sm">{exercise.name}</div>
                <div className="text-xs text-zinc-500 capitalize">{exercise.muscle} • {exercise.tier}</div>
              </div>
              <PlusIcon size={16} className="text-zinc-400" />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              No exercises found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProgressiveChartProps {
  lift: Lift;
  unit: WeightUnit;
  onClose: () => void;
}

function ProgressiveChart({ lift, unit, onClose }: ProgressiveChartProps) {
  const history = lift.history.slice(-20);

  const maxWeight = Math.max(...history.map((h) => h.w), lift.weight);
  const minWeight = Math.min(...history.map((h) => h.w), lift.weight);
  const range = maxWeight - minWeight || 10;

  const chartHeight = 120;
  const chartWidth = 300;
  const padding = 30;

  const points = history.map((h, i) => ({
    x: padding + (i / Math.max(history.length - 1, 1)) * (chartWidth - padding * 2),
    y: chartHeight - padding - ((h.w - minWeight) / range) * (chartHeight - padding * 2),
    weight: h.w,
    reps: h.r,
    date: h.date,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2 className="font-semibold">{lift.name} - Progress</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <span className="text-xl">×</span>
          </button>
        </div>

        <div className="p-4">
          {history.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              No history yet. Complete some sets to see your progress!
            </div>
          ) : (
            <>
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full mb-4">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = chartHeight - padding - ratio * (chartHeight - padding * 2);
                  return (
                    <g key={ratio}>
                      <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="currentColor" strokeOpacity="0.1" />
                      <text x={padding - 5} y={y + 4} textAnchor="end" className="text-[8px] fill-zinc-500">
                        {Math.round(minWeight + ratio * range)}
                      </text>
                    </g>
                  );
                })}

                {/* Line */}
                <path d={pathD} fill="none" stroke="#4ECDC4" strokeWidth="2" />

                {/* Points */}
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3" fill="#4ECDC4" />
                ))}

                {/* Current weight marker */}
                <circle
                  cx={chartWidth - padding}
                  cy={chartHeight - padding - ((lift.weight - minWeight) / range) * (chartHeight - padding * 2)}
                  r="4"
                  fill="#FFE66D"
                />
              </svg>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{history.length}</div>
                  <div className="text-xs text-zinc-500">Sessions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{maxWeight}</div>
                  <div className="text-xs text-zinc-500">Best ({unit})</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{Math.round((maxWeight - minWeight) * 10) / 10}</div>
                  <div className="text-xs text-zinc-500">Progress</div>
                </div>
              </div>

              {/* History list */}
              <div className="mt-4 max-h-40 overflow-y-auto space-y-1">
                {history.slice(-5).reverse().map((h, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-500">{h.date}</span>
                    <span className="font-medium tabular-nums">{h.w} × {h.r}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface CelebrationOverlayProps {
  onClose: () => void;
}

function CelebrationOverlay({ onClose }: CelebrationOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="text-center animate-bounce">
        <div className="text-8xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-white mb-2">Workout Complete!</h2>
        <p className="text-zinc-300 mb-6">Great job crushing it today!</p>
        <button
          onClick={onClose}
          className="px-8 py-3 bg-white text-zinc-900 rounded-xl font-semibold hover:bg-zinc-100 transition-colors"
        >
          Finish
        </button>
      </div>
    </div>
  );
}

interface RestCoachProps {
  seconds: number;
  onComplete: () => void;
  onSkip: () => void;
}

function RestCoach({ seconds, onComplete, onSkip }: RestCoachProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTimeLeft(seconds);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          onComplete();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [seconds, onComplete]);

  const progress = ((seconds - timeLeft) / seconds) * 100;

  return (
    <div className="fixed bottom-4 right-4 bg-zinc-900 text-white rounded-2xl p-4 shadow-2xl z-40">
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#333" strokeWidth="2" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="#4ECDC4"
              strokeWidth="2"
              strokeDasharray="100"
              strokeDashoffset={100 - progress}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
            {timeLeft}
          </span>
        </div>
        <div>
          <div className="text-xs text-zinc-400">Rest</div>
          <button onClick={onSkip} className="text-sm hover:text-zinc-300">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function TrainLogger() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [showChartFor, setShowChartFor] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [restTimer, setRestTimer] = useState<{ seconds: number; active: boolean } | null>(null);

  const unit: WeightUnit = state.kgMode ? "kg" : "lbs";

  // Persist state
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Get active day
  const activeDay = state.days.find((d) => d.id === state.activeDayId) || state.days[0];
  const activeDayId = activeDay?.id || state.days[0]?.id;

  const updateDay = useCallback((dayId: string, updater: (day: Day) => Day) => {
    setState((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.id === dayId ? updater(d) : d)),
    }));
  }, []);

  const addExercise = useCallback((exercise: { name: string; muscle: string; tier: "primary" | "secondary" | "accessory" }) => {
    const newLift: Lift = {
      id: generateId(),
      name: exercise.name,
      muscle: exercise.muscle,
      tier: exercise.tier,
      targetSets: exercise.tier === "primary" ? 4 : exercise.tier === "secondary" ? 3 : 2,
      targetReps: exercise.tier === "primary" ? 8 : 10,
      weight: 0,
      rest: 90,
      history: [],
      sets: [],
      hidden: false,
      overload: [],
      stars: 0,
    };
    updateDay(activeDayId, (day) => ({ ...day, lifts: [...day.lifts, newLift] }));
    setState((prev) => ({ ...prev, showLibrary: false }));
  }, [activeDayId, updateDay]);

  const handleSetChange = useCallback((liftId: string, sets: SetEntry[]) => {
    updateDay(activeDayId, (day) => ({
      ...day,
      lifts: day.lifts.map((l) => (l.id === liftId ? { ...l, sets } : l)),
    }));
  }, [activeDayId, updateDay]);

  const handleAddSet = useCallback((liftId: string) => {
    updateDay(activeDayId, (day) => ({
      ...day,
      lifts: day.lifts.map((l) => {
        if (l.id !== liftId) return l;
        const lastSet = l.sets[l.sets.length - 1];
        return {
          ...l,
          sets: [
            ...l.sets,
            {
              weight: lastSet?.weight || l.weight,
              reps: lastSet?.reps || l.targetReps,
              done: false,
              failed: false,
            },
          ],
        };
      }),
    }));
  }, [activeDayId, updateDay]);

  const handleRemoveSet = useCallback((liftId: string, setIndex: number) => {
    updateDay(activeDayId, (day) => ({
      ...day,
      lifts: day.lifts.map((l) => {
        if (l.id !== liftId) return l;
        return { ...l, sets: l.sets.filter((_, i) => i !== setIndex) };
      }),
    }));
  }, [activeDayId, updateDay]);

  const handleToggleHidden = useCallback((liftId: string) => {
    updateDay(activeDayId, (day) => ({
      ...day,
      lifts: day.lifts.map((l) => (l.id === liftId ? { ...l, hidden: !l.hidden } : l)),
    }));
  }, [activeDayId, updateDay]);

  const handleDeleteLift = useCallback((liftId: string) => {
    updateDay(activeDayId, (day) => ({
      ...day,
      lifts: day.lifts.filter((l) => l.id !== liftId),
    }));
  }, [activeDayId, updateDay]);

  const handleStar = useCallback((liftId: string) => {
    updateDay(activeDayId, (day) => ({
      ...day,
      lifts: day.lifts.map((l) => {
        if (l.id !== liftId) return l;
        return { ...l, stars: l.stars >= 3 ? 0 : l.stars + 1 };
      }),
    }));
  }, [activeDayId, updateDay]);

  const handleFinishDay = useCallback(() => {
    // Save sets to history
    const today = formatDate(new Date());
    updateDay(activeDayId, (day) => ({
      ...day,
      lifts: day.lifts.map((l) => {
        const completedSets = l.sets.filter((s) => s.done);
        if (completedSets.length === 0) return l;
        const totalVolume = completedSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
        const bestSet = completedSets.reduce((best, s) => (s.weight > best.weight ? s : best), completedSets[0]);
        return {
          ...l,
          weight: bestSet.weight,
          history: [
            ...l.history,
            {
              w: bestSet.weight,
              r: bestSet.reps,
              date: today,
              sets: completedSets.map((s) => ({ r: s.reps, fail: s.failed })),
            },
          ],
          sets: [],
        };
      }),
    }));
    setShowCelebration(true);
  }, [activeDayId, updateDay]);

  const handleRestComplete = useCallback(() => {
    setRestTimer(null);
  }, []);

  const chartLift = showChartFor ? activeDay?.lifts.find((l) => l.id === showChartFor) : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-30">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">Train Logger</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setState((prev) => ({ ...prev, showSettings: true }))}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <GearIcon size={20} />
              </button>
            </div>
          </div>

          {/* Day Board */}
          <DayBoard
            days={state.days}
            activeDayId={activeDayId}
            onSelectDay={(id) => setState((prev) => ({ ...prev, activeDayId: id }))}
            onRenameDay={(id, name) => updateDay(id, (d) => ({ ...d, name }))}
            onRemoveDay={(id) => setState((prev) => ({ ...prev, days: prev.days.filter((d) => d.id !== id) }))}
            onAddDay={() => {
              const name = prompt("Day name:");
              if (name) {
                setState((prev) => ({
                  ...prev,
                  days: [...prev.days, { id: generateId(), name, lifts: [] }],
                }));
              }
            }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 pb-32">
        {activeDay?.lifts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💪</div>
            <h2 className="text-lg font-semibold mb-2">Ready to train?</h2>
            <p className="text-zinc-500 mb-6">Add your first exercise to get started</p>
            <button
              onClick={() => setState((prev) => ({ ...prev, showLibrary: true }))}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2 mx-auto"
            >
              <PlusIcon size={18} /> Add Exercise
            </button>
          </div>
        ) : (
          <>
            {activeDay?.lifts.map((lift) => (
              <LiftCard
                key={lift.id}
                lift={lift}
                unit={unit}
                onSetChange={handleSetChange}
                onToggleHidden={handleToggleHidden}
                onDelete={handleDeleteLift}
                onAddSet={handleAddSet}
                onRemoveSet={handleRemoveSet}
                onStar={handleStar}
                showChart={setShowChartFor}
              />
            ))}

            {/* Add Exercise Button */}
            <button
              onClick={() => setState((prev) => ({ ...prev, showLibrary: true }))}
              className="w-full py-4 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl text-zinc-500 hover:border-zinc-400 hover:text-zinc-600 transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <PlusIcon size={18} /> Add Exercise
            </button>

            {/* Finish Button */}
            {activeDay && activeDay.name.toLowerCase() !== "rest" && (
              <div className="mt-6">
                <button
                  onClick={handleFinishDay}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-green-500/25"
                >
                  Finish {activeDay.name}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB - Quick Add */}
      <button
        onClick={() => setState((prev) => ({ ...prev, showLibrary: true }))}
        className="fixed bottom-6 right-6 w-14 h-14 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      >
        <PlusIcon size={24} />
      </button>

      {/* Rest Coach */}
      {restTimer?.active && (
        <RestCoach
          seconds={restTimer.seconds}
          onComplete={handleRestComplete}
          onSkip={handleRestComplete}
        />
      )}

      {/* Exercise Library Modal */}
      {state.showLibrary && (
        <ExerciseLibrary
          onSelect={addExercise}
          onClose={() => setState((prev) => ({ ...prev, showLibrary: false }))}
        />
      )}

      {/* Progressive Chart Modal */}
      {chartLift && (
        <ProgressiveChart
          lift={chartLift}
          unit={unit}
          onClose={() => setShowChartFor(null)}
        />
      )}

      {/* Celebration */}
      {showCelebration && (
        <CelebrationOverlay onClose={() => setShowCelebration(false)} />
      )}

      {/* Settings Modal */}
      {state.showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                onClick={() => setState((prev) => ({ ...prev, showSettings: false }))}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="text-xl">×</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Unit Toggle */}
              <div className="flex items-center justify-between">
                <span className="font-medium">Weight Unit</span>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => setState((prev) => ({ ...prev, kgMode: true }))}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      state.kgMode ? "bg-white dark:bg-zinc-700 shadow" : ""
                    }`}
                  >
                    kg
                  </button>
                  <button
                    onClick={() => setState((prev) => ({ ...prev, kgMode: false }))}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      !state.kgMode ? "bg-white dark:bg-zinc-700 shadow" : ""
                    }`}
                  >
                    lbs
                  </button>
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={() => {
                  if (confirm("Reset all data? This cannot be undone.")) {
                    localStorage.removeItem(STORAGE_KEY);
                    setState({ days: DEFAULT_DAYS, activeDayId: null, kgMode: true, showSettings: false, showLibrary: false, showChart: false });
                  }
                }}
                className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
