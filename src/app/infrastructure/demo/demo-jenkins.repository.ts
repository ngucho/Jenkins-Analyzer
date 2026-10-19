import { Injectable } from '@angular/core';
import { concat, delay, map, Observable, of, range } from 'rxjs';
import { AgentNode } from '@domain/agent-node';
import { Build } from '@domain/build';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { DAY, HOUR, MINUTE, overlaps, TimeWindow } from '@domain/time-window';
import { weekdayOf } from '@domain/analytics/weekly-heatmap';
import { JenkinsJob } from '@domain/job';
import { stableHash } from '@domain/planning/jenkins-cron';
import {
  ConnectionReport,
  JenkinsRepository,
  ScheduleFetchEvent,
  WorkloadFetchEvent,
} from '@ports/jenkins.repository';

type DemoDays = 'all' | 'workdays' | readonly number[];

/** Profil d'un job fictif : quand il tourne et combien de temps. */
interface DemoJobProfile {
  readonly name: string;
  readonly node: string;
  /** Jobs planifiés : planification Jenkins et heures de lancement correspondantes. */
  readonly cron?: string;
  readonly scheduledHours?: readonly number[];
  /** Jours d'exécution (0 = lundi) ; par défaut, jours ouvrés. */
  readonly days?: DemoDays;
  /** Lancements par heure ouvrée (jobs déclenchés par les commits). */
  readonly commitsPerHour?: number;
  readonly averageMinutes: number;
  readonly failureRate: number;
}

const PROFILES: readonly DemoJobProfile[] = [
  { name: 'backend/api-build', node: 'agent-linux-01', commitsPerHour: 2.2, averageMinutes: 9, failureRate: 0.08 },
  { name: 'backend/api-tests', node: 'agent-linux-01', commitsPerHour: 1.4, averageMinutes: 22, failureRate: 0.12 },
  { name: 'frontend/web-build', node: 'agent-linux-02', commitsPerHour: 1.8, averageMinutes: 7, failureRate: 0.05 },
  { name: 'frontend/e2e', node: 'agent-linux-02', commitsPerHour: 0.6, averageMinutes: 35, failureRate: 0.18 },
  { name: 'quality/sonar-analysis', node: 'built-in', cron: 'H 12,18 * * 1-5', scheduledHours: [12, 18], averageMinutes: 25, failureRate: 0.03 },
  { name: 'quality/security-scan', node: 'agent-linux-01', cron: 'H 18 * * 1-5', scheduledHours: [18], averageMinutes: 40, failureRate: 0.05 },
  { name: 'nightly/full-regression', node: 'agent-linux-01', cron: 'H 1 * * *', scheduledHours: [1], days: 'all', averageMinutes: 140, failureRate: 0.1 },
  { name: 'nightly/perf-tests', node: 'agent-linux-02', cron: 'H 1 * * 1-5', scheduledHours: [1], averageMinutes: 90, failureRate: 0.08 },
  { name: 'nightly/docker-images', node: 'agent-linux-02', cron: 'H 3 * * *', scheduledHours: [3], days: 'all', averageMinutes: 45, failureRate: 0.04 },
  { name: 'ops/db-backup', node: 'built-in', cron: 'H 23 * * *', scheduledHours: [23], days: 'all', averageMinutes: 30, failureRate: 0.01 },
  { name: 'ops/weekly-report', node: 'built-in', cron: 'H 9 * * 1', scheduledHours: [9], days: [0], averageMinutes: 60, failureRate: 0.02 },
  { name: 'release/deploy-staging', node: 'built-in', cron: 'H 10,15 * * 1-5', scheduledHours: [10, 15], averageMinutes: 12, failureRate: 0.06 },
];

const NODES: readonly AgentNode[] = [
  { name: 'built-in', executors: 2, online: true, idle: true },
  { name: 'agent-linux-01', executors: 2, online: true, idle: false },
  { name: 'agent-linux-02', executors: 2, online: true, idle: true },
];

const WORKDAY_HOURS = { from: 8, to: 19 };
const SIMULATED_LATENCY = 120;

/** Générateur pseudo-aléatoire déterministe : les mêmes heures donnent les mêmes builds. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Source de données fictive et réaliste, pour essayer l'application sans Jenkins. */
@Injectable({ providedIn: 'root' })
export class DemoJenkinsRepository extends JenkinsRepository {
  checkConnection(): Observable<ConnectionReport> {
    return of({ version: 'démo', jobCount: PROFILES.length, nodes: NODES }).pipe(
      delay(SIMULATED_LATENCY),
    );
  }

  fetchWorkload(_settings: JenkinsSettings, window: TimeWindow): Observable<WorkloadFetchEvent> {
    const now = Date.now();
    const builds = PROFILES.flatMap((profile) => generateBuilds(profile, window, now));
    const progress$ = range(1, PROFILES.length).pipe(
      map((completed): WorkloadFetchEvent => ({ type: 'progress', completed, total: PROFILES.length })),
    );
    const complete$ = of<WorkloadFetchEvent>({
      type: 'complete',
      result: {
        window,
        jobs: PROFILES.map(({ name }) => ({ fullName: name, url: '#', ref: name })),
        builds,
        nodes: NODES,
        fetchedAt: now,
        truncatedJobs: [],
        failedJobs: [],
      },
    });
    return concat(progress$, complete$).pipe(delay(SIMULATED_LATENCY));
  }

  fetchSchedules(_settings: JenkinsSettings, jobs: readonly JenkinsJob[]): Observable<ScheduleFetchEvent> {
    const specs = new Map<string, readonly string[]>();
    for (const profile of PROFILES) {
      if (profile.cron && jobs.some((job) => job.ref === profile.name)) specs.set(profile.name, [profile.cron]);
    }
    return of<ScheduleFetchEvent>({ type: 'complete', result: { specs, unreadableJobs: [] } }).pipe(
      delay(SIMULATED_LATENCY),
    );
  }
}

function generateBuilds(profile: DemoJobProfile, window: TimeWindow, now: number): Build[] {
  const builds: Build[] = [];
  const firstHour = Math.floor(window.start / HOUR) * HOUR - DAY;

  for (let hourStart = firstHour; hourStart < window.end; hourStart += HOUR) {
    const random = seededRandom(hourStart / HOUR + profile.name.length * 7919);
    for (const start of launchesInHour(profile, hourStart, random)) {
      if (start > now) continue;
      const duration = profile.averageMinutes * MINUTE * (0.6 + random() * 0.8);
      const running = start + duration > now;
      const number = Math.floor((start - Date.UTC(2024, 0, 1)) / MINUTE);
      const build: Build = {
        id: `${profile.name}#${number}`,
        jobName: profile.name,
        number,
        start,
        end: running ? now : start + duration,
        result: running ? 'RUNNING' : pickResult(profile.failureRate, random()),
        node: profile.node,
        trigger: profile.cron ? 'timer' : 'scm',
        url: '#',
      };
      if (overlaps(build, window)) builds.push(build);
    }
  }
  return builds;
}

function launchesInHour(profile: DemoJobProfile, hourStart: number, random: () => number): number[] {
  const hour = new Date(hourStart).getHours();
  if (!runsOn(profile.days ?? 'workdays', weekdayOf(hourStart))) return [];

  if (profile.scheduledHours) {
    // Comme Jenkins avec « H » : une minute fixe propre au job, à quelques secondes près.
    const minute = stableHash(profile.name) % 60;
    return profile.scheduledHours.includes(hour) ? [hourStart + minute * MINUTE + random() * 40_000] : [];
  }

  const isWorkingHour = hour >= WORKDAY_HOURS.from && hour < WORKDAY_HOURS.to;
  if (!isWorkingHour) return [];
  const lunchDip = hour === 12 ? 0.4 : 1;
  const expected = (profile.commitsPerHour ?? 0) * lunchDip;
  const count = Math.floor(expected + random());
  return Array.from({ length: count }, () => hourStart + random() * HOUR);
}

function runsOn(days: DemoDays, weekday: number): boolean {
  if (days === 'all') return true;
  if (days === 'workdays') return weekday < 5;
  return days.includes(weekday);
}

function pickResult(failureRate: number, draw: number): Build['result'] {
  if (draw < failureRate * 0.7) return 'FAILURE';
  if (draw < failureRate) return 'UNSTABLE';
  if (draw > 0.985) return 'ABORTED';
  return 'SUCCESS';
}
