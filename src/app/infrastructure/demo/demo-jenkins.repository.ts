import { Injectable } from '@angular/core';
import { concat, delay, map, Observable, of, range } from 'rxjs';
import { AgentNode } from '@domain/agent-node';
import { Build } from '@domain/build';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { DAY, HOUR, MINUTE, overlaps, TimeWindow } from '@domain/time-window';
import { weekdayOf } from '@domain/analytics/weekly-heatmap';
import { ConnectionReport, JenkinsRepository, WorkloadFetchEvent } from '@ports/jenkins.repository';

/** Profil d'un job fictif : quand il tourne et combien de temps. */
interface DemoJobProfile {
  readonly name: string;
  readonly node: string;
  /** Heures de lancement fixes (jobs planifiés). */
  readonly scheduledHours?: readonly number[];
  /** Lancements par heure ouvrée (jobs déclenchés par les commits). */
  readonly commitsPerHour?: number;
  readonly weekendToo?: boolean;
  readonly averageMinutes: number;
  readonly failureRate: number;
}

const PROFILES: readonly DemoJobProfile[] = [
  { name: 'backend/api-build', node: 'agent-linux-01', commitsPerHour: 2.2, averageMinutes: 9, failureRate: 0.08 },
  { name: 'backend/api-tests', node: 'agent-linux-01', commitsPerHour: 1.4, averageMinutes: 22, failureRate: 0.12 },
  { name: 'frontend/web-build', node: 'agent-linux-02', commitsPerHour: 1.8, averageMinutes: 7, failureRate: 0.05 },
  { name: 'frontend/e2e', node: 'agent-linux-02', commitsPerHour: 0.6, averageMinutes: 35, failureRate: 0.18 },
  { name: 'quality/sonar-analysis', node: 'built-in', scheduledHours: [12, 18], averageMinutes: 25, failureRate: 0.03 },
  { name: 'nightly/full-regression', node: 'agent-linux-01', scheduledHours: [1], weekendToo: true, averageMinutes: 140, failureRate: 0.1 },
  { name: 'nightly/docker-images', node: 'agent-linux-02', scheduledHours: [3], weekendToo: true, averageMinutes: 45, failureRate: 0.04 },
  { name: 'ops/db-backup', node: 'built-in', scheduledHours: [23], weekendToo: true, averageMinutes: 30, failureRate: 0.01 },
  { name: 'release/deploy-staging', node: 'built-in', scheduledHours: [10, 15], averageMinutes: 12, failureRate: 0.06 },
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
      snapshot: {
        window,
        jobs: PROFILES.map(({ name }) => ({ fullName: name, url: '#' })),
        builds,
        nodes: NODES,
        fetchedAt: now,
        truncatedJobs: [],
        failedJobs: [],
      },
    });
    return concat(progress$, complete$).pipe(delay(SIMULATED_LATENCY));
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
        url: '#',
      };
      if (overlaps(build, window)) builds.push(build);
    }
  }
  return builds;
}

function launchesInHour(profile: DemoJobProfile, hourStart: number, random: () => number): number[] {
  const date = new Date(hourStart);
  const hour = date.getHours();
  const isWeekend = weekdayOf(hourStart) >= 5;
  if (isWeekend && !profile.weekendToo) return [];

  if (profile.scheduledHours) {
    return profile.scheduledHours.includes(hour) ? [hourStart + random() * 5 * MINUTE] : [];
  }

  const isWorkingHour = hour >= WORKDAY_HOURS.from && hour < WORKDAY_HOURS.to;
  if (!isWorkingHour) return [];
  const lunchDip = hour === 12 ? 0.4 : 1;
  const expected = (profile.commitsPerHour ?? 0) * lunchDip;
  const count = Math.floor(expected + random());
  return Array.from({ length: count }, () => hourStart + random() * HOUR);
}

function pickResult(failureRate: number, draw: number): Build['result'] {
  if (draw < failureRate * 0.7) return 'FAILURE';
  if (draw < failureRate) return 'UNSTABLE';
  if (draw > 0.985) return 'ABORTED';
  return 'SUCCESS';
}
