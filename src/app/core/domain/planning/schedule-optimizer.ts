import { ScheduledJob } from './scheduled-job';
import {
  analyzeMovability,
  DailyPattern,
  durationMinutes,
  patternStarts,
  patternToCron,
  shiftPattern,
} from './daily-pattern';
import {
  addRun,
  costOfAdding,
  gridFromProfile,
  gridMetrics,
  LoadGrid,
  LoadMetrics,
} from './load-grid';
import { addJobOccurrences } from './week-grid';
import { WeeklyProfile } from './weekly-profile';

const SHIFT_STEP_MINUTES = 15;
const MAX_PASSES = 4;
/** Coût d'un décalage d'une heure : on ne bouge un job que si le gain le justifie. */
const SHIFT_PENALTY_PER_HOUR = 0.05;

export interface OptimizationInput {
  readonly profile: WeeklyProfile;
  readonly jobs: readonly ScheduledJob[];
  readonly capacity: number;
  readonly maxShiftMinutes: number;
  /** Jobs à laisser à leur place. */
  readonly locked: ReadonlySet<string>;
  /** Début de la semaine de référence (lundi 00:00), pour les jobs non déplaçables. */
  readonly referenceWeekStart: number;
}

export interface ScheduleChange {
  readonly jobName: string;
  readonly from: DailyPattern;
  readonly to: DailyPattern;
  readonly fromSpec: string;
  readonly toCron: string;
  readonly shiftMinutes: number;
}

export interface FixedJob {
  readonly jobName: string;
  readonly reason: string;
}

export interface OptimizationResult {
  readonly changes: readonly ScheduleChange[];
  readonly fixedJobs: readonly FixedJob[];
  /** Charge attendue de la semaine type, avant / après. */
  readonly before: readonly number[];
  readonly after: readonly number[];
  readonly metricsBefore: LoadMetrics;
  readonly metricsAfter: LoadMetrics;
}

interface Candidate {
  readonly job: ScheduledJob;
  readonly pattern: DailyPattern;
  readonly duration: number;
  shift: number;
}

/**
 * Propose de décaler les jobs planifiés pour lisser la charge de la semaine
 * type. Recherche locale : chaque job, tour à tour, est retiré puis replacé
 * au meilleur décalage autorisé, jusqu'à stabilisation.
 */
export function optimizeSchedules(input: OptimizationInput): OptimizationResult {
  const { profile, jobs, capacity, maxShiftMinutes, locked } = input;
  const grid = gridFromProfile(profile);
  const fixedJobs: FixedJob[] = [];
  const candidates: Candidate[] = [];

  for (const job of jobs) {
    const movability = analyzeMovability(job);
    if (locked.has(job.jobName)) {
      fixedJobs.push({ jobName: job.jobName, reason: 'Verrouillé' });
    } else if (!movability.movable) {
      fixedJobs.push({ jobName: job.jobName, reason: movability.reason });
    } else {
      candidates.push({ job, pattern: movability.pattern, duration: durationMinutes(job), shift: 0 });
      continue;
    }
    addJobOccurrences(grid, job, input.referenceWeekStart);
  }

  for (const c of candidates) place(grid, c, 1);
  const before = Array.from(grid);

  // Les jobs les plus lourds d'abord : ce sont eux qui créent les pics.
  const ordered = [...candidates].sort(
    (a, b) => b.duration * patternStarts(b.pattern).length - a.duration * patternStarts(a.pattern).length,
  );
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;
    for (const candidate of ordered) {
      place(grid, candidate, -1);
      const best = bestShift(grid, candidate, capacity, maxShiftMinutes);
      if (best !== candidate.shift) moved = true;
      candidate.shift = best;
      place(grid, candidate, 1);
    }
    if (!moved) break;
  }

  const changes = candidates
    .filter((c) => c.shift !== 0)
    .map((c) => {
      const to = shiftPattern(c.pattern, c.shift)!;
      return {
        jobName: c.job.jobName,
        from: c.pattern,
        to,
        fromSpec: c.job.spec,
        toCron: patternToCron(to),
        shiftMinutes: c.shift,
      };
    })
    .sort((a, b) => a.jobName.localeCompare(b.jobName));

  return {
    changes,
    fixedJobs,
    before,
    after: Array.from(grid),
    metricsBefore: gridMetrics(Float64Array.from(before), capacity),
    metricsAfter: gridMetrics(grid, capacity),
  };
}

function bestShift(grid: LoadGrid, c: Candidate, capacity: number, maxShift: number): number {
  let best = 0;
  let bestScore = scoreOf(grid, c, 0, capacity);
  for (let shift = -maxShift; shift <= maxShift; shift += SHIFT_STEP_MINUTES) {
    if (shift === 0) continue;
    const score = scoreOf(grid, c, shift, capacity);
    if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) < 1e-9 && Math.abs(shift) < Math.abs(best))) {
      best = shift;
      bestScore = score;
    }
  }
  return best;
}

function scoreOf(grid: LoadGrid, c: Candidate, shift: number, capacity: number): number {
  const pattern = shiftPattern(c.pattern, shift);
  if (pattern === null) return Infinity;
  const cost = patternStarts(pattern).reduce(
    (sum, start) => sum + costOfAdding(grid, start, c.duration, capacity),
    0,
  );
  return cost + (SHIFT_PENALTY_PER_HOUR * Math.abs(shift)) / 60;
}

function place(grid: LoadGrid, c: Candidate, amount: number): void {
  const pattern = shiftPattern(c.pattern, c.shift)!;
  for (const start of patternStarts(pattern)) addRun(grid, start, c.duration, amount);
}
