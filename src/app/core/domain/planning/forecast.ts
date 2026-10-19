import { computeLoadSeries } from '../analytics/load-series';
import { IdleSlot } from '../analytics/occupancy';
import { TimeWindow, windowDuration } from '../time-window';
import { ScheduledJob, scheduledRuns } from './scheduled-job';
import {
  computeWeeklyProfile,
  PROFILE_SLOT,
  WEEK,
  WeeklyProfile,
  weekSlotOf,
} from './weekly-profile';

/** Écart couvrant ~80 % des cas si la charge suit une loi normale. */
const BAND_Z = 1.28;

/** Prévision de charge sur un quart d'heure. */
export interface ForecastPoint extends TimeWindow {
  /** Charge attendue (builds simultanés en moyenne). */
  readonly expected: number;
  readonly low: number;
  readonly high: number;
  /** Part de la charge attendue venant des jobs planifiés. */
  readonly scheduled: number;
}

/**
 * Prévision = charge habituelle (profil hebdomadaire, hors jobs planifiés)
 * + exécutions planifiées connues, projetées avec leur durée typique.
 */
export function forecastLoad(
  profile: WeeklyProfile,
  jobs: readonly ScheduledJob[],
  window: TimeWindow,
): ForecastPoint[] {
  const runs = scheduledRuns(jobs, window);
  return computeLoadSeries(runs, window, PROFILE_SLOT).map((point) => {
    const slot = weekSlotOf(point.start);
    const base = profile.mean[slot];
    const margin = BAND_Z * profile.spread[slot];
    return {
      start: point.start,
      end: point.end,
      scheduled: point.averageLoad,
      expected: base + point.averageLoad,
      low: Math.max(0, base - margin) + point.averageLoad,
      high: base + margin + point.averageLoad,
    };
  });
}

/** Périodes où la valeur choisie reste sous un seuil, d'une durée minimale. */
export function findForecastWindows(
  points: readonly ForecastPoint[],
  accept: (point: ForecastPoint) => boolean,
  minDuration: number,
): IdleSlot[] {
  const windows: IdleSlot[] = [];
  let current: TimeWindow | null = null;
  const close = () => {
    if (current && windowDuration(current) >= minDuration) {
      windows.push({ ...current, duration: windowDuration(current) });
    }
    current = null;
  };
  for (const point of points) {
    if (!accept(point)) {
      close();
    } else {
      current = current ? { start: current.start, end: point.end } : { start: point.start, end: point.end };
    }
  }
  close();
  return windows;
}

export interface BacktestResult {
  /** Erreur absolue moyenne, en builds simultanés. */
  readonly meanAbsoluteError: number;
  /** Charge réelle moyenne sur la semaine testée, pour relativiser l'erreur. */
  readonly actualMean: number;
  readonly window: TimeWindow;
}

/**
 * Rejoue la méthode sur la dernière semaine : profil appris sur les semaines
 * précédentes, comparé à ce qui s'est réellement passé.
 * Il faut au moins deux semaines d'historique.
 */
export function backtestForecast(params: {
  readonly history: TimeWindow;
  readonly baselineIntervals: readonly TimeWindow[];
  readonly allIntervals: readonly TimeWindow[];
  readonly jobs: readonly ScheduledJob[];
}): BacktestResult | null {
  const { history, baselineIntervals, allIntervals, jobs } = params;
  if (windowDuration(history) < 2 * WEEK) return null;

  const cut = history.end - WEEK;
  const test = { start: cut, end: history.end };
  const profile = computeWeeklyProfile(
    baselineIntervals.filter((i) => i.start < cut),
    { start: history.start, end: cut },
  );
  const predicted = forecastLoad(profile, jobs, test);
  const actual = computeLoadSeries(allIntervals, test, PROFILE_SLOT);

  const n = Math.min(predicted.length, actual.length);
  if (n === 0) return null;
  let error = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    error += Math.abs(predicted[i].expected - actual[i].averageLoad);
    total += actual[i].averageLoad;
  }
  return { meanAbsoluteError: error / n, actualMean: total / n, window: test };
}
