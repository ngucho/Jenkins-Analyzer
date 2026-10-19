import { MINUTE } from '../time-window';
import { durationMinutes } from './daily-pattern';
import { cronOccurrences } from './jenkins-cron';
import { addRun, gridFromProfile, LoadGrid } from './load-grid';
import { ScheduledJob } from './scheduled-job';
import { WEEK, WeeklyProfile } from './weekly-profile';

/** Ajoute à la grille les exécutions réelles d'un job sur la semaine de référence. */
export function addJobOccurrences(grid: LoadGrid, job: ScheduledJob, weekStart: number): void {
  const week = { start: weekStart, end: weekStart + WEEK };
  for (const schedule of job.schedules) {
    for (const time of cronOccurrences(schedule, week)) {
      addRun(grid, Math.round((time - weekStart) / MINUTE), durationMinutes(job));
    }
  }
}

/** Semaine type complète : charge habituelle + tous les jobs planifiés. */
export function buildWeekGrid(
  profile: WeeklyProfile,
  jobs: readonly ScheduledJob[],
  weekStart: number,
): LoadGrid {
  const grid = gridFromProfile(profile);
  for (const job of jobs) addJobOccurrences(grid, job, weekStart);
  return grid;
}
