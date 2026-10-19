import { HOUR, TimeWindow } from '../time-window';
import { computeLoadSeries } from './load-series';

export const WEEKDAYS = 7;
export const HOURS_PER_DAY = 24;

export interface HeatmapCell {
  /** 0 = lundi … 6 = dimanche. */
  readonly weekday: number;
  readonly hour: number;
  /** Nombre moyen de builds simultanés sur ce créneau ; `null` sans données. */
  readonly averageLoad: number | null;
  /** Nombre de créneaux observés sur la période. */
  readonly samples: number;
}

/** Matrice [jour][heure] de la charge moyenne. */
export type WeeklyHeatmap = readonly (readonly HeatmapCell[])[];

export interface MaintenanceWindow {
  readonly weekday: number;
  readonly startHour: number;
  readonly durationHours: number;
  readonly averageLoad: number;
}

/** Lundi = 0, conformément à l'usage français. */
export function weekdayOf(time: number): number {
  return (new Date(time).getDay() + 6) % 7;
}

function startOfNextHour(time: number): number {
  const date = new Date(time);
  if (date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) {
    return time;
  }
  date.setMinutes(60, 0, 0);
  return date.getTime();
}

/** Charge moyenne par jour de la semaine et heure, sur les heures pleines de la fenêtre. */
export function computeWeeklyHeatmap(
  intervals: readonly TimeWindow[],
  window: TimeWindow,
): WeeklyHeatmap {
  const totals = Array.from({ length: WEEKDAYS }, () =>
    Array.from({ length: HOURS_PER_DAY }, () => ({ load: 0, samples: 0 })),
  );

  const alignedStart = startOfNextHour(window.start);
  const fullHoursEnd = alignedStart + Math.floor((window.end - alignedStart) / HOUR) * HOUR;
  if (fullHoursEnd > alignedStart) {
    const hours = computeLoadSeries(intervals, { start: alignedStart, end: fullHoursEnd }, HOUR);
    for (const point of hours) {
      const cell = totals[weekdayOf(point.start)][new Date(point.start).getHours()];
      cell.load += point.averageLoad;
      cell.samples += 1;
    }
  }

  return totals.map((row, weekday) =>
    row.map(({ load, samples }, hour) => ({
      weekday,
      hour,
      samples,
      averageLoad: samples > 0 ? load / samples : null,
    })),
  );
}

/**
 * Cherche les créneaux hebdomadaires récurrents les moins chargés, d'une durée
 * donnée, sans chevauchement entre eux. Les créneaux sans données sont ignorés.
 */
export function suggestMaintenanceWindows(
  heatmap: WeeklyHeatmap,
  durationHours: number,
  count = 3,
): MaintenanceWindow[] {
  const hoursPerWeek = WEEKDAYS * HOURS_PER_DAY;
  const cells = heatmap.flat();
  if (durationHours < 1 || durationHours > hoursPerWeek) return [];

  const candidates: MaintenanceWindow[] = [];
  for (let first = 0; first < hoursPerWeek; first++) {
    let load = 0;
    let complete = true;
    for (let offset = 0; offset < durationHours && complete; offset++) {
      const cell = cells[(first + offset) % hoursPerWeek];
      complete = cell.averageLoad !== null;
      load += cell.averageLoad ?? 0;
    }
    if (complete) {
      candidates.push({
        weekday: Math.floor(first / HOURS_PER_DAY),
        startHour: first % HOURS_PER_DAY,
        durationHours,
        averageLoad: load / durationHours,
      });
    }
  }

  const chosen: MaintenanceWindow[] = [];
  const taken = new Set<number>();
  for (const candidate of candidates.sort((a, b) => a.averageLoad - b.averageLoad)) {
    const first = candidate.weekday * HOURS_PER_DAY + candidate.startHour;
    const hours = Array.from({ length: durationHours }, (_, i) => (first + i) % hoursPerWeek);
    if (hours.some((hour) => taken.has(hour))) continue;
    hours.forEach((hour) => taken.add(hour));
    chosen.push(candidate);
    if (chosen.length === count) break;
  }
  return chosen;
}
