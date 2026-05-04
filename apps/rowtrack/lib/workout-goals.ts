import type { IoniconsName } from '@/components/Icon';

// --- Types ---

export type GoalType = 'duration' | 'distance' | 'split' | 'watts';

export interface WorkoutGoal {
  type: GoalType;
  target: number; // seconden (duration), meters (distance), sec/500m (split), watt
}

export interface GoalProgress {
  current: number;
  target: number;
  percentage: number; // 0–100, clamped
  reached: boolean;
}

// --- Config per goal type ---

export interface GoalTypeConfig {
  label: string;
  icon: IoniconsName;
  unit: string;
  placeholder: string;
  formatTarget: (value: number) => string;
  formatCurrent: (value: number) => string;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const GOAL_TYPES: Record<GoalType, GoalTypeConfig> = {
  duration: {
    label: 'Tijd',
    icon: 'time-outline',
    unit: 'min',
    placeholder: '30',
    formatTarget: (v) => `${v / 60} min`,
    formatCurrent: (v) => fmtTime(v),
  },
  distance: {
    label: 'Afstand',
    icon: 'navigate-outline',
    unit: 'm',
    placeholder: '5000',
    formatTarget: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${v} m`),
    formatCurrent: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${Math.round(v)} m`),
  },
  split: {
    label: 'Split',
    icon: 'speedometer-outline',
    unit: 'sec/500m',
    placeholder: '120',
    formatTarget: (v) => `${fmtTime(v)}/500m`,
    formatCurrent: (v) => `${fmtTime(v)}/500m`,
  },
  watts: {
    label: 'Watt',
    icon: 'flash-outline',
    unit: 'W',
    placeholder: '180',
    formatTarget: (v) => `${v} W`,
    formatCurrent: (v) => `${Math.round(v)} W`,
  },
};

export const GOAL_TYPE_ORDER: GoalType[] = ['duration', 'distance', 'split', 'watts'];

// --- Input conversie ---

export function userInputToTarget(type: GoalType, input: number): number {
  if (type === 'duration') return input * 60;
  return input;
}

export function targetToUserInput(type: GoalType, target: number): number {
  if (type === 'duration') return target / 60;
  return target;
}

// --- Progress berekening ---

export function calculateProgress(
  goal: WorkoutGoal,
  metrics: {
    seconds: number;
    distanceMeters: number;
    splitSeconds: number;
    avgWatts: number;
  },
): GoalProgress {
  const { type, target } = goal;

  switch (type) {
    case 'duration': {
      const current = metrics.seconds;
      const percentage = Math.min((current / target) * 100, 100);
      return { current, target, percentage, reached: current >= target };
    }
    case 'distance': {
      const current = metrics.distanceMeters;
      const percentage = Math.min((current / target) * 100, 100);
      return { current, target, percentage, reached: current >= target };
    }
    case 'split': {
      const current = metrics.splitSeconds;
      if (current <= 0) return { current, target, percentage: 0, reached: false };
      const reached = current <= target;
      const percentage = reached ? 100 : Math.min((target / current) * 100, 99);
      return { current, target, percentage, reached };
    }
    case 'watts': {
      const current = metrics.avgWatts;
      const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
      return { current, target, percentage, reached: current >= target };
    }
  }
}
