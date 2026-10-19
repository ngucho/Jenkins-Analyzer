/** Durées de référence, en millisecondes. */
export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Intervalle de temps semi-ouvert [start, end[, en millisecondes epoch. */
export interface TimeWindow {
  readonly start: number;
  readonly end: number;
}

export function windowDuration(window: TimeWindow): number {
  return Math.max(0, window.end - window.start);
}

export function lastDays(days: number, now: number = Date.now()): TimeWindow {
  return { start: now - days * DAY, end: now };
}

export function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Restreint un intervalle à une fenêtre ; `null` s'ils ne se chevauchent pas. */
export function clipToWindow(interval: TimeWindow, window: TimeWindow): TimeWindow | null {
  const start = Math.max(interval.start, window.start);
  const end = Math.min(interval.end, window.end);
  return end > start ? { start, end } : null;
}
