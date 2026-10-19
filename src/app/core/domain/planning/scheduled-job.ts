import { Build, buildDuration, isFinished } from '../build';
import { MINUTE, TimeWindow } from '../time-window';
import {
  CronFieldName,
  cronOccurrences,
  CronSchedule,
  CronSyntaxError,
  HashResolver,
  parseJenkinsCron,
  stableHash,
} from './jenkins-cron';

/** Durée supposée d'un job planifié qui n'a encore jamais tourné. */
export const DEFAULT_RUN_DURATION = 10 * MINUTE;

/** Un job déclenché par planification (cron), prêt à être projeté dans le futur. */
export interface ScheduledJob {
  readonly jobName: string;
  /** Planification telle que saisie dans Jenkins. */
  readonly spec: string;
  readonly schedules: readonly CronSchedule[];
  /** Durée typique d'une exécution (médiane de l'historique). */
  readonly duration: number;
  readonly durationKnown: boolean;
  /** Les `H` ont été déduits d'une exécution réelle (sinon : approximation). */
  readonly hashFromHistory: boolean;
}

export interface InvalidSchedule {
  readonly jobName: string;
  readonly spec: string;
  readonly reason: string;
}

/** Une exécution planifiée à venir. */
export interface ScheduledRun extends TimeWindow {
  readonly jobName: string;
}

/**
 * Transforme les planifications brutes en jobs planifiés, en s'appuyant sur
 * l'historique pour la durée et pour retrouver la valeur des `H`.
 */
export function buildScheduledJobs(
  specs: ReadonlyMap<string, readonly string[]>,
  builds: readonly Build[],
): { jobs: ScheduledJob[]; invalid: InvalidSchedule[] } {
  const jobs: ScheduledJob[] = [];
  const invalid: InvalidSchedule[] = [];

  for (const [jobName, jobSpecs] of specs) {
    const spec = jobSpecs.join('\n');
    const history = builds.filter((b) => b.jobName === jobName);
    const lastTimerRun = history
      .filter((b) => b.trigger === 'timer')
      .reduce<number | null>((latest, b) => (latest === null || b.start > latest ? b.start : latest), null);
    try {
      const schedules = parseJenkinsCron(spec, hashResolver(jobName, lastTimerRun));
      if (schedules.length === 0) continue;
      const duration = typicalDuration(history);
      jobs.push({
        jobName,
        spec,
        schedules,
        duration: duration ?? DEFAULT_RUN_DURATION,
        durationKnown: duration !== null,
        hashFromHistory: lastTimerRun !== null,
      });
    } catch (error) {
      if (!(error instanceof CronSyntaxError)) throw error;
      invalid.push({ jobName, spec, reason: error.message });
    }
  }
  return { jobs: jobs.sort((a, b) => a.jobName.localeCompare(b.jobName)), invalid };
}

/**
 * Jenkins calcule `H` à partir d'un hachage interne du nom du job, que l'on ne
 * peut pas reproduire exactement. On le retrouve donc dans la dernière
 * exécution planifiée observée ; à défaut, on prend une valeur stable.
 */
function hashResolver(jobName: string, observed: number | null): HashResolver {
  return (field, min, max) => {
    const span = max - min + 1;
    const value = observed === null ? stableHash(`${jobName}:${field}`) : component(field, new Date(observed));
    return min + (((value - min) % span) + span) % span;
  };
}

function component(field: CronFieldName, date: Date): number {
  switch (field) {
    case 'minute':
      return date.getMinutes();
    case 'hour':
      return date.getHours();
    case 'dayOfMonth':
      return date.getDate();
    case 'month':
      return date.getMonth() + 1;
    case 'dayOfWeek':
      return date.getDay();
  }
}

/** Médiane des durées des builds terminés, en privilégiant les exécutions planifiées. */
function typicalDuration(history: readonly Build[]): number | null {
  const finished = history.filter(isFinished);
  const timer = finished.filter((b) => b.trigger === 'timer');
  const sample = (timer.length >= 3 ? timer : finished).map(buildDuration).sort((a, b) => a - b);
  if (sample.length === 0) return null;
  const middle = Math.floor(sample.length / 2);
  return sample.length % 2 === 1 ? sample[middle] : (sample[middle - 1] + sample[middle]) / 2;
}

/** Exécutions des jobs planifiés qui recouvrent la fenêtre. */
export function scheduledRuns(jobs: readonly ScheduledJob[], window: TimeWindow): ScheduledRun[] {
  const runs: ScheduledRun[] = [];
  for (const job of jobs) {
    // On remonte d'une durée de job pour capter les exécutions déjà commencées.
    const search = { start: window.start - job.duration, end: window.end };
    for (const schedule of job.schedules) {
      for (const start of cronOccurrences(schedule, search)) {
        const end = start + job.duration;
        if (end > window.start) runs.push({ jobName: job.jobName, start, end });
      }
    }
  }
  return runs.sort((a, b) => a.start - b.start);
}
