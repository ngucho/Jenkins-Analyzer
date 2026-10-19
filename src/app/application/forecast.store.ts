import { computed, inject, Injectable, signal } from '@angular/core';
import { backtestForecast, findForecastWindows, forecastLoad } from '@domain/planning/forecast';
import { scheduledRuns } from '@domain/planning/scheduled-job';
import { ceilToSlot } from '@domain/planning/weekly-profile';
import { DAY, HOUR } from '@domain/time-window';
import { PlanningStore } from './planning.store';
import { SettingsStore } from './settings.store';

export const FORECAST_HORIZONS = [1, 2, 3, 7] as const;
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

/** Seuil sous lequel la machine est considérée comme calme (borne haute de la prévision). */
const QUIET_THRESHOLD = 0.5;

/** Prévision de charge sur les prochains jours. */
@Injectable({ providedIn: 'root' })
export class ForecastStore {
  private readonly planning = inject(PlanningStore);
  private readonly settings = inject(SettingsStore).settings;

  readonly horizonDays = signal<ForecastHorizon>(2);

  readonly window = computed(() => {
    const start = ceilToSlot(this.planning.now());
    return { start, end: start + this.horizonDays() * DAY };
  });

  readonly points = computed(() => {
    const profile = this.planning.profile();
    return profile ? forecastLoad(profile, this.planning.scheduledJobs(), this.window()) : [];
  });

  readonly runs = computed(() => scheduledRuns(this.planning.scheduledJobs(), this.window()));

  readonly summary = computed(() => {
    const points = this.points();
    if (points.length === 0) return null;
    const peak = points.reduce((best, p) => (p.expected > best.expected ? p : best));
    const average = points.reduce((s, p) => s + p.expected, 0) / points.length;
    return { average, peak, runCount: this.runs().length };
  });

  /** Fenêtres où même la borne haute reste très basse : candidates pour une maintenance. */
  readonly quietWindows = computed(() =>
    findForecastWindows(
      this.points(),
      (p) => p.high < QUIET_THRESHOLD && p.scheduled === 0,
      this.settings().maintenanceDurationHours * HOUR,
    ),
  );

  /** Périodes où la borne haute atteint la capacité : risque de file d'attente. */
  readonly saturationRisks = computed(() => {
    const capacity = this.planning.capacity();
    return capacity > 0 ? findForecastWindows(this.points(), (p) => p.high >= capacity, 0) : [];
  });

  readonly backtest = computed(() => {
    const snapshot = this.planning.snapshot();
    if (!snapshot) return null;
    return backtestForecast({
      history: snapshot.window,
      baselineIntervals: this.planning.baselineBuilds(),
      allIntervals: snapshot.builds,
      jobs: this.planning.scheduledJobs(),
    });
  });
}
