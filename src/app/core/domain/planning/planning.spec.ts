import { Build } from '../build';
import { HOUR, MINUTE } from '../time-window';
import { analyzeMovability, patternToCron, shiftPattern } from './daily-pattern';
import { forecastLoad } from './forecast';
import { buildScheduledJobs, scheduledRuns } from './scheduled-job';
import { optimizeSchedules } from './schedule-optimizer';
import { suggestRecurringSlots } from './slot-finder';
import { buildWeekGrid } from './week-grid';
import { computeWeeklyProfile, SLOTS_PER_WEEK, WEEK, WeeklyProfile } from './weekly-profile';

/** Lundi 6 janvier 2025, 00:00 heure locale. */
const MONDAY = new Date(2025, 0, 6).getTime();

function build(jobName: string, start: number, minutes: number, trigger: Build['trigger'] = 'timer'): Build {
  return {
    id: `${jobName}-${start}`,
    jobName,
    number: 1,
    start,
    end: start + minutes * MINUTE,
    result: 'SUCCESS',
    node: null,
    trigger,
    url: '#',
  };
}

function flatProfile(load = 0): WeeklyProfile {
  const mean = new Array(SLOTS_PER_WEEK).fill(load);
  return { mean, spread: new Array(SLOTS_PER_WEEK).fill(0), coverage: 1, weeksObserved: 4 };
}

describe('buildScheduledJobs', () => {
  it('retrouve H dans la dernière exécution planifiée et prend la durée médiane', () => {
    const history = [20, 30, 40].map((m, i) => build('nightly', MONDAY + i * 24 * HOUR + 2 * HOUR + 17 * MINUTE, m));
    const { jobs } = buildScheduledJobs(new Map([['nightly', ['H 2 * * *']]]), history);
    expect(jobs[0].schedules[0].minutes).toEqual([17]);
    expect(jobs[0].duration).toBe(30 * MINUTE);
    expect(jobs[0].hashFromHistory).toBeTrue();
  });

  it('signale les planifications illisibles sans bloquer les autres', () => {
    const { jobs, invalid } = buildScheduledJobs(
      new Map([
        ['ok', ['0 3 * * *']],
        ['ko', ['tous les soirs']],
      ]),
      [],
    );
    expect(jobs.map((j) => j.jobName)).toEqual(['ok']);
    expect(invalid[0].jobName).toBe('ko');
  });
});

describe('forecastLoad', () => {
  it('additionne charge habituelle et exécutions planifiées', () => {
    const { jobs } = buildScheduledJobs(new Map([['n', ['0 2 * * *']]]), []);
    const window = { start: MONDAY + 2 * HOUR, end: MONDAY + 3 * HOUR };
    const points = forecastLoad(flatProfile(0.5), jobs, window);
    expect(points.length).toBe(4);
    // Durée par défaut : 10 min sur le premier quart d'heure.
    expect(points[0].scheduled).toBeCloseTo(10 / 15);
    expect(points[0].expected).toBeCloseTo(0.5 + 10 / 15);
    expect(points[1].expected).toBeCloseTo(0.5);
  });

  it('apprend la charge habituelle sur l’historique', () => {
    const history = [0, 1, 2, 3].map((w) => build('ci', MONDAY + w * WEEK + 9 * HOUR, 60, 'scm'));
    const profile = computeWeeklyProfile(history, { start: MONDAY, end: MONDAY + 4 * WEEK });
    const nine = 9 * 4 + 1; // lundi 09:15, hors effet de lissage
    expect(profile.mean[nine]).toBeCloseTo(1);
    expect(profile.coverage).toBe(1);
  });
});

describe('daily-pattern', () => {
  it('décale un job tous les jours en passant minuit', () => {
    const { jobs } = buildScheduledJobs(new Map([['n', ['30 23 * * *']]]), []);
    const movability = analyzeMovability(jobs[0]);
    if (!movability.movable) fail('devrait être déplaçable');
    else expect(patternToCron(shiftPattern(movability.pattern, 90)!)).toBe('0 1 * * *');
  });

  it('refuse un décalage qui changerait de jour un job à jours fixes', () => {
    const { jobs } = buildScheduledJobs(new Map([['n', ['30 23 * * 1-5']]]), []);
    const movability = analyzeMovability(jobs[0]);
    expect(movability.movable && shiftPattern(movability.pattern, 60)).toBeNull();
  });
});

describe('optimizeSchedules', () => {
  it('sépare deux jobs lourds lancés en même temps', () => {
    const history = ['a', 'b'].flatMap((name) => [build(name, MONDAY + HOUR, 60), build(name, MONDAY + 25 * HOUR, 60)]);
    const { jobs } = buildScheduledJobs(new Map([['a', ['0 1 * * *']], ['b', ['0 1 * * *']]]), history);
    const result = optimizeSchedules({
      profile: flatProfile(0),
      jobs,
      capacity: 1,
      maxShiftMinutes: 3 * 60,
      locked: new Set(),
      referenceWeekStart: MONDAY,
    });
    expect(result.metricsBefore.peak).toBeCloseTo(2);
    expect(result.metricsAfter.peak).toBeCloseTo(1);
    expect(result.changes.length).toBe(1);
  });

  it('ne déplace pas un job verrouillé', () => {
    const { jobs } = buildScheduledJobs(new Map([['a', ['0 1 * * *']], ['b', ['0 1 * * *']]]), []);
    const result = optimizeSchedules({
      profile: flatProfile(0),
      jobs,
      capacity: 1,
      maxShiftMinutes: 60,
      locked: new Set(['a', 'b']),
      referenceWeekStart: MONDAY,
    });
    expect(result.changes).toEqual([]);
    expect(result.fixedJobs.length).toBe(2);
  });
});

describe('suggestRecurringSlots', () => {
  it('évite les heures chargées et respecte la plage autorisée', () => {
    const profile = flatProfile(0);
    const mean = profile.mean as number[];
    for (let day = 0; day < 7; day++) for (let q = 0; q < 8; q++) mean[day * 96 + 22 * 4 + q] = 3; // 22:00-24:00 chargé
    const grid = buildWeekGrid(profile, [], MONDAY);
    const [best] = suggestRecurringSlots(
      grid,
      { durationMinutes: 60, recurrence: { kind: 'daily' }, allowedHours: { from: 20, to: 2 } },
      4,
    );
    const hour = Math.floor(best.start / 60);
    expect([20, 0, 1]).toContain(hour);
    expect(best.cron).toMatch(/^\d+ \d+ \* \* \*$/);
  });
});

describe('scheduledRuns', () => {
  it('inclut une exécution commencée avant la fenêtre', () => {
    const { jobs } = buildScheduledJobs(new Map([['n', ['0 1 * * *']]]), [build('n', MONDAY - WEEK + HOUR, 120)]);
    const runs = scheduledRuns(jobs, { start: MONDAY + 2 * HOUR, end: MONDAY + 4 * HOUR });
    expect(runs.length).toBe(1);
  });
});
