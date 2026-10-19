import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, catchError, of } from 'rxjs';
import { analyzeWorkload } from '@domain/analytics/workload-analysis';
import { computeLoadSeries, pickBucketSize } from '@domain/analytics/load-series';
import {
  computeWeeklyHeatmap,
  suggestMaintenanceWindows,
} from '@domain/analytics/weekly-heatmap';
import { onlineExecutors } from '@domain/agent-node';
import { JenkinsError } from '@domain/jenkins-error';
import { MINUTE, overlaps, TimeWindow, windowDuration } from '@domain/time-window';
import { WorkloadSnapshot } from '@domain/workload-snapshot';
import { JenkinsRepository, WorkloadFetchEvent } from '@ports/jenkins.repository';
import { MIN_ZOOM_DURATION, PeriodId, windowForPeriod } from './period';
import { SettingsStore } from './settings.store';

type LoadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly completed: number; readonly total: number }
  | { readonly status: 'error'; readonly message: string };

/**
 * État de l'écran d'analyse : chargement depuis Jenkins, filtres, zoom,
 * et indicateurs dérivés (tous calculés par le domaine).
 */
@Injectable({ providedIn: 'root' })
export class WorkloadStore {
  private readonly repository = inject(JenkinsRepository);
  private readonly settingsStore = inject(SettingsStore);
  private readonly loadRequests = new Subject<PeriodId>();

  private readonly loadState = signal<LoadState>({ status: 'idle' });
  private readonly snapshotState = signal<WorkloadSnapshot | null>(null);

  readonly period = signal<PeriodId>('7d');
  readonly jobFilter = signal('');
  readonly zoom = signal<TimeWindow | null>(null);

  readonly snapshot = this.snapshotState.asReadonly();
  readonly loading = computed(() => this.loadState().status === 'loading');
  readonly progress = computed(() => {
    const state = this.loadState();
    return state.status === 'loading' && state.total > 0 ? state.completed / state.total : null;
  });
  readonly error = computed(() => {
    const state = this.loadState();
    return state.status === 'error' ? state.message : null;
  });

  /** Builds de la période, après filtre sur le nom du job. */
  readonly builds = computed(() => {
    const builds = this.snapshotState()?.builds ?? [];
    const filter = this.jobFilter().trim().toLowerCase();
    return filter ? builds.filter((b) => b.jobName.toLowerCase().includes(filter)) : builds;
  });

  readonly capacity = computed(() => onlineExecutors(this.snapshotState()?.nodes ?? []));

  /** Fenêtre affichée : la période chargée, ou la zone zoomée. */
  readonly viewWindow = computed(() => this.zoom() ?? this.snapshotState()?.window ?? null);

  readonly analysis = computed(() => {
    const window = this.viewWindow();
    if (!window) return null;
    const idleThreshold = this.settingsStore.settings().idleThresholdMinutes * MINUTE;
    return analyzeWorkload(this.builds(), window, { idleThreshold });
  });

  readonly visibleBuilds = computed(() => {
    const window = this.viewWindow();
    return window ? this.builds().filter((build) => overlaps(build, window)) : [];
  });

  readonly loadSeries = computed(() => {
    const window = this.viewWindow();
    return window ? computeLoadSeries(this.visibleBuilds(), window, pickBucketSize(window)) : [];
  });

  /** La heatmap porte toujours sur toute la période : c'est elle qui révèle les habitudes. */
  readonly heatmap = computed(() => {
    const window = this.snapshotState()?.window;
    return window ? computeWeeklyHeatmap(this.builds(), window) : null;
  });

  readonly maintenanceWindows = computed(() => {
    const heatmap = this.heatmap();
    const hours = this.settingsStore.settings().maintenanceDurationHours;
    return heatmap ? suggestMaintenanceWindows(heatmap, hours) : [];
  });

  constructor() {
    this.loadRequests
      .pipe(
        switchMap((period) =>
          this.repository
            .fetchWorkload(this.settingsStore.settings(), windowForPeriod(period))
            .pipe(catchError((error: unknown) => of(toErrorState(error)))),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((event) => this.apply(event));
  }

  load(): void {
    this.loadState.set({ status: 'loading', completed: 0, total: 0 });
    this.loadRequests.next(this.period());
  }

  selectPeriod(period: PeriodId): void {
    this.period.set(period);
    this.zoom.set(null);
    this.load();
  }

  zoomTo(window: TimeWindow): void {
    if (windowDuration(window) >= MIN_ZOOM_DURATION) this.zoom.set(window);
  }

  resetZoom(): void {
    this.zoom.set(null);
  }

  private apply(event: WorkloadFetchEvent | LoadState): void {
    if ('status' in event) {
      this.loadState.set(event);
    } else if (event.type === 'progress') {
      this.loadState.set({ status: 'loading', completed: event.completed, total: event.total });
    } else {
      this.snapshotState.set(event.result);
      this.zoom.set(null);
      this.loadState.set({ status: 'idle' });
    }
  }
}

function toErrorState(error: unknown): LoadState {
  const message =
    error instanceof JenkinsError ? error.message : 'Erreur inattendue lors du chargement.';
  return { status: 'error', message };
}
