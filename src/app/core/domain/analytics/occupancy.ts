import { clipToWindow, TimeWindow, windowDuration } from '../time-window';

export interface IdleSlot extends TimeWindow {
  readonly duration: number;
}

/** Fusionne des intervalles qui se chevauchent ou se touchent. */
export function mergeIntervals(intervals: readonly TimeWindow[]): TimeWindow[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: TimeWindow[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, interval.end) };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

/** Périodes, dans la fenêtre, pendant lesquelles au moins un build tourne. */
export function busyPeriods(intervals: readonly TimeWindow[], window: TimeWindow): TimeWindow[] {
  const clipped = intervals
    .map((interval) => clipToWindow(interval, window))
    .filter((interval): interval is TimeWindow => interval !== null);
  return mergeIntervals(clipped);
}

export function busyTime(intervals: readonly TimeWindow[], window: TimeWindow): number {
  return busyPeriods(intervals, window).reduce((sum, period) => sum + windowDuration(period), 0);
}

/** Plages sans aucun build d'au moins `minDuration` ms, dans l'ordre chronologique. */
export function findIdleSlots(
  intervals: readonly TimeWindow[],
  window: TimeWindow,
  minDuration: number,
): IdleSlot[] {
  const slots: IdleSlot[] = [];
  let cursor = window.start;
  for (const period of [...busyPeriods(intervals, window), { start: window.end, end: window.end }]) {
    const duration = period.start - cursor;
    if (duration >= minDuration && duration > 0) {
      slots.push({ start: cursor, end: period.start, duration });
    }
    cursor = Math.max(cursor, period.end);
  }
  return slots;
}
