import { MINUTE } from '../time-window';
import { ScheduledJob } from './scheduled-job';

/**
 * Forme de planification que l'on sait déplacer et réécrire en cron :
 * une minute fixe, une ou plusieurs heures, certains jours de la semaine.
 * Couvre l'essentiel des jobs nocturnes et des tâches périodiques en journée.
 */
export interface DailyPattern {
  readonly minute: number;
  readonly hours: readonly number[];
  /** Jours cron (0 = dimanche) ; `null` = tous les jours. */
  readonly weekdays: readonly number[] | null;
  /** Texte du champ jour de semaine, conservé tel quel dans le cron proposé. */
  readonly weekdayField: string;
}

export type Movability =
  | { readonly movable: true; readonly pattern: DailyPattern }
  | { readonly movable: false; readonly reason: string };

const MAX_RUNS_PER_DAY = 6;

export function analyzeMovability(job: ScheduledJob): Movability {
  if (job.schedules.length !== 1) {
    return { movable: false, reason: 'Planification sur plusieurs lignes' };
  }
  const [schedule] = job.schedules;
  if (schedule.daysOfMonth.length < 31 || schedule.months.length < 12) {
    return { movable: false, reason: 'Planification mensuelle ou annuelle' };
  }
  if (schedule.minutes.length !== 1) {
    return { movable: false, reason: 'Plusieurs exécutions par heure' };
  }
  if (schedule.hours.length > MAX_RUNS_PER_DAY) {
    return { movable: false, reason: `Plus de ${MAX_RUNS_PER_DAY} exécutions par jour` };
  }
  return {
    movable: true,
    pattern: {
      minute: schedule.minutes[0],
      hours: schedule.hours,
      weekdays: schedule.daysOfWeek.length === 7 ? null : schedule.daysOfWeek,
      weekdayField: schedule.fields[4],
    },
  };
}

/**
 * Décale toutes les exécutions de `delta` minutes. Si le job ne tourne que
 * certains jours, un décalage qui ferait changer de jour est refusé (`null`) :
 * le cron proposé deviendrait trompeur.
 */
export function shiftPattern(pattern: DailyPattern, deltaMinutes: number): DailyPattern | null {
  const times = pattern.hours.map((h) => h * 60 + pattern.minute + deltaMinutes);
  if (pattern.weekdays !== null && times.some((t) => t < 0 || t >= 24 * 60)) return null;
  const normalized = times.map((t) => ((t % 1440) + 1440) % 1440);
  return {
    ...pattern,
    minute: normalized[0] % 60,
    hours: [...new Set(normalized.map((t) => Math.floor(t / 60)))].sort((a, b) => a - b),
  };
}

export function patternToCron(pattern: DailyPattern): string {
  const weekdays = pattern.weekdays === null ? '*' : pattern.weekdayField;
  return `${pattern.minute} ${pattern.hours.join(',')} * * ${weekdays}`;
}

/** Débuts d'exécution sur la semaine type, en minutes depuis lundi 00:00. */
export function patternStarts(pattern: DailyPattern): number[] {
  const starts: number[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const cronDay = (dayIndex + 1) % 7; // lundi = 1 en cron
    if (pattern.weekdays !== null && !pattern.weekdays.includes(cronDay)) continue;
    for (const hour of pattern.hours) starts.push(dayIndex * 1440 + hour * 60 + pattern.minute);
  }
  return starts;
}

export function durationMinutes(job: ScheduledJob): number {
  return Math.max(1, Math.round(job.duration / MINUTE));
}
