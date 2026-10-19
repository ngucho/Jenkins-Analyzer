import { computeLoadSeries } from '../analytics/load-series';
import { weekdayOf } from '../analytics/weekly-heatmap';
import { DAY, MINUTE, TimeWindow } from '../time-window';

/** Résolution des prévisions et de la planification. */
export const PROFILE_SLOT = 15 * MINUTE;
export const WEEK = 7 * DAY;
export const SLOTS_PER_DAY = DAY / PROFILE_SLOT;
export const SLOTS_PER_WEEK = WEEK / PROFILE_SLOT;

/**
 * Charge « habituelle » par quart d'heure de la semaine (672 créneaux),
 * apprise sur l'historique : moyenne pondérée et dispersion.
 */
export interface WeeklyProfile {
  readonly mean: readonly number[];
  /** Écart-type : sert à encadrer la prévision. */
  readonly spread: readonly number[];
  /** Part des créneaux de la semaine observés au moins une fois. */
  readonly coverage: number;
  readonly weeksObserved: number;
}

export interface ProfileOptions {
  /** Poids divisé par deux toutes les N semaines : le passé récent compte plus. */
  readonly halfLifeWeeks: number;
}

const DEFAULT_OPTIONS: ProfileOptions = { halfLifeWeeks: 2 };

/** Index du quart d'heure dans la semaine (lundi 00:00 = 0), en heure locale. */
export function weekSlotOf(time: number): number {
  const date = new Date(time);
  return (
    weekdayOf(time) * SLOTS_PER_DAY +
    date.getHours() * 4 +
    Math.floor(date.getMinutes() / 15)
  );
}

/** Arrondit au quart d'heure local supérieur. */
export function ceilToSlot(time: number): number {
  const date = new Date(time);
  const minutes = date.getMinutes();
  if (minutes % 15 === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) return time;
  date.setMinutes(Math.floor(minutes / 15) * 15 + 15, 0, 0);
  return date.getTime();
}

/** Lundi suivant à 00:00 : début de la « semaine de référence » de la planification. */
export function nextMonday(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + (7 - weekdayOf(date.getTime())));
  return date.getTime();
}

export function computeWeeklyProfile(
  intervals: readonly TimeWindow[],
  window: TimeWindow,
  options: ProfileOptions = DEFAULT_OPTIONS,
): WeeklyProfile {
  const weight = new Float64Array(SLOTS_PER_WEEK);
  const sum = new Float64Array(SLOTS_PER_WEEK);
  const squares = new Float64Array(SLOTS_PER_WEEK);

  const start = ceilToSlot(window.start);
  const end = start + Math.floor((window.end - start) / PROFILE_SLOT) * PROFILE_SLOT;
  if (end > start) {
    for (const point of computeLoadSeries(intervals, { start, end }, PROFILE_SLOT)) {
      const slot = weekSlotOf(point.start);
      const ageWeeks = (window.end - point.start) / WEEK;
      const w = 0.5 ** (ageWeeks / options.halfLifeWeeks);
      weight[slot] += w;
      sum[slot] += w * point.averageLoad;
      squares[slot] += w * point.averageLoad ** 2;
    }
  }

  const mean = Array.from(weight, (w, i) => (w > 0 ? sum[i] / w : 0));
  const spread = Array.from(weight, (w, i) =>
    w > 0 ? Math.sqrt(Math.max(0, squares[i] / w - mean[i] ** 2)) : 0,
  );
  return {
    mean: smooth(mean),
    spread: smooth(spread),
    coverage: weight.filter((w) => w > 0).length / SLOTS_PER_WEEK,
    weeksObserved: Math.max(0, (end - start) / WEEK),
  };
}

/** Moyenne glissante circulaire sur trois quarts d'heure : atténue le bruit. */
function smooth(values: readonly number[]): number[] {
  const n = values.length;
  return values.map((v, i) => (values[(i - 1 + n) % n] + v + values[(i + 1) % n]) / 3);
}
