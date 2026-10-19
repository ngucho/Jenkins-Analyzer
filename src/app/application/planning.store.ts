import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, map, Observable, of, Subject, switchMap } from 'rxjs';
import { onlineExecutors } from '@domain/agent-node';
import { JenkinsError } from '@domain/jenkins-error';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { buildScheduledJobs } from '@domain/planning/scheduled-job';
import { computeWeeklyProfile } from '@domain/planning/weekly-profile';
import { lastDays } from '@domain/time-window';
import { WorkloadSnapshot } from '@domain/workload-snapshot';
import { JenkinsRepository, ScheduleReport } from '@ports/jenkins.repository';
import { SettingsStore } from './settings.store';

export type PlanningPhase = 'history' | 'schedules';

type LoadState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'loading';
      readonly phase: PlanningPhase;
      readonly completed: number;
      readonly total: number;
    }
  | { readonly status: 'error'; readonly message: string };

interface PlanningData {
  readonly snapshot: WorkloadSnapshot;
  readonly schedules: ScheduleReport;
}

/**
 * Données communes aux prévisions, à l'optimisation et au conseil de
 * planification : un historique long (indépendant de la période du tableau
 * de bord) et les planifications cron des jobs. Chargées une fois, à la demande.
 */
@Injectable({ providedIn: 'root' })
export class PlanningStore {
  private readonly repository = inject(JenkinsRepository);
  private readonly settingsStore = inject(SettingsStore);
  private readonly loadRequests = new Subject<void>();
  private readonly loadState = signal<LoadState>({ status: 'idle' });
  private readonly data = signal<PlanningData | null>(null);

  readonly loading = computed(() => this.loadState().status === 'loading');
  readonly phase = computed(() => {
    const state = this.loadState();
    return state.status === 'loading' ? state.phase : null;
  });
  readonly progress = computed(() => {
    const state = this.loadState();
    return state.status === 'loading' && state.total > 0 ? state.completed / state.total : null;
  });
  readonly error = computed(() => {
    const state = this.loadState();
    return state.status === 'error' ? state.message : null;
  });

  readonly snapshot = computed(() => this.data()?.snapshot ?? null);
  readonly schedules = computed(() => this.data()?.schedules ?? null);
  /** Instant de référence des calculs : celui du chargement (résultats reproductibles). */
  readonly now = computed(() => this.snapshot()?.fetchedAt ?? Date.now());
  readonly capacity = computed(() => onlineExecutors(this.snapshot()?.nodes ?? []));

  private readonly scheduled = computed(() => {
    const data = this.data();
    return data ? buildScheduledJobs(data.schedules.specs, data.snapshot.builds) : null;
  });
  readonly scheduledJobs = computed(() => this.scheduled()?.jobs ?? []);
  readonly invalidSchedules = computed(() => this.scheduled()?.invalid ?? []);

  /**
   * Builds « non planifiés » : les exécutions planifiées de jobs dont on connaît
   * le cron sont retirées, puisqu'elles sont projetées explicitement.
   */
  readonly baselineBuilds = computed(() => {
    const builds = this.snapshot()?.builds ?? [];
    const known = new Set(this.scheduledJobs().map((job) => job.jobName));
    return builds.filter((b) => !(b.trigger === 'timer' && known.has(b.jobName)));
  });

  readonly profile = computed(() => {
    const snapshot = this.snapshot();
    return snapshot ? computeWeeklyProfile(this.baselineBuilds(), snapshot.window) : null;
  });

  readonly ready = computed(() => this.profile() !== null);

  constructor() {
    this.loadRequests
      .pipe(
        switchMap(() => this.fetchAll().pipe(catchError((error: unknown) => of(toError(error))))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((state) => this.loadState.set(state));
  }

  /** Charge si rien n'est encore chargé (appelé à l'ouverture d'une page). */
  ensureLoaded(): void {
    if (!this.data() && !this.loading() && !this.error()) this.load();
  }

  load(): void {
    this.loadState.set({ status: 'loading', phase: 'history', completed: 0, total: 0 });
    this.loadRequests.next();
  }

  /** Oublie les données (ex. après changement des paramètres). */
  reset(): void {
    this.data.set(null);
    this.loadState.set({ status: 'idle' });
  }

  /** Historique d'abord, puis planifications des jobs découverts. */
  private fetchAll(): Observable<LoadState> {
    const settings = this.settingsStore.settings();
    return this.repository.fetchWorkload(settings, lastDays(settings.planningHistoryDays)).pipe(
      concatMap((event) =>
        event.type === 'progress'
          ? of(progressState('history', event))
          : this.fetchSchedules(settings, event.result),
      ),
    );
  }

  private fetchSchedules(settings: JenkinsSettings, snapshot: WorkloadSnapshot): Observable<LoadState> {
    return this.repository.fetchSchedules(settings, snapshot.jobs).pipe(
      map((event): LoadState => {
        if (event.type === 'progress') return progressState('schedules', event);
        this.data.set({ snapshot, schedules: event.result });
        return { status: 'idle' };
      }),
    );
  }
}

function progressState(
  phase: PlanningPhase,
  event: { readonly completed: number; readonly total: number },
): LoadState {
  return { status: 'loading', phase, completed: event.completed, total: event.total };
}

function toError(error: unknown): LoadState {
  const message =
    error instanceof JenkinsError ? error.message : 'Erreur inattendue lors du chargement.';
  return { status: 'error', message };
}
