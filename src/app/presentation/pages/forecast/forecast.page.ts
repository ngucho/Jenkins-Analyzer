import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FORECAST_HORIZONS, ForecastStore } from '@application/forecast.store';
import { PlanningStore } from '@application/planning.store';
import { SettingsStore } from '@application/settings.store';
import { PROFILE_SLOT } from '@domain/planning/weekly-profile';
import { PlanningStatus } from '../../components/planning-status/planning-status';
import { Stat, StatGrid } from '../../components/stat-grid/stat-grid';
import { ChartBar, ChartHighlight, ChartSeries } from '../../components/time-series-chart/chart.model';
import { TimeSeriesChart } from '../../components/time-series-chart/time-series-chart';
import {
  formatDateTime,
  formatDuration,
  formatRange,
  formatShortDate,
} from '../../shared/format';

const UPCOMING_RUNS_SHOWN = 15;

@Component({
  selector: 'app-forecast-page',
  imports: [PlanningStatus, StatGrid, TimeSeriesChart],
  templateUrl: './forecast.page.html',
  styleUrls: ['../planning-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastPage implements OnInit {
  protected readonly planning = inject(PlanningStore);
  protected readonly store = inject(ForecastStore);
  protected readonly settings = inject(SettingsStore).settings;
  protected readonly horizons = FORECAST_HORIZONS;
  protected readonly slotSize = PROFILE_SLOT;

  protected readonly series = computed<ChartSeries[]>(() => [
    { label: 'Charge attendue', kind: 'area', tone: 'accent', values: this.store.points().map((p) => p.expected) },
    { label: 'Dont jobs planifiés', kind: 'line', tone: 'scheduled', values: this.store.points().map((p) => p.scheduled) },
  ]);

  protected readonly band = computed(() => ({
    label: 'Fourchette probable',
    lower: this.store.points().map((p) => p.low),
    upper: this.store.points().map((p) => p.high),
  }));

  protected readonly highlights = computed<ChartHighlight[]>(() => [
    ...this.store.quietWindows().map((w) => ({ ...w, tone: 'idle' as const })),
    ...this.store.saturationRisks().map((w) => ({ ...w, tone: 'danger' as const })),
  ]);

  protected readonly bars = computed<ChartBar[]>(() =>
    this.store.runs().map((run) => ({
      id: `${run.jobName}-${run.start}`,
      start: run.start,
      end: run.end,
      label: run.jobName,
      tone: 'scheduled',
    })),
  );

  protected readonly stats = computed<Stat[]>(() => {
    const summary = this.store.summary();
    if (!summary) return [];
    const capacity = this.planning.capacity();
    const risks = this.store.saturationRisks();
    const riskTime = risks.reduce((s, w) => s + w.duration, 0);
    const [quiet] = this.store.quietWindows();
    const backtest = this.store.backtest();
    return [
      {
        label: 'Charge moyenne prévue',
        value: summary.average.toFixed(1),
        hint: capacity > 0 ? `builds simultanés, sur ${capacity} exécuteurs` : 'builds simultanés',
      },
      {
        label: 'Pic prévu',
        value: summary.peak.expected.toFixed(1),
        hint: formatDateTime(summary.peak.start),
        tone: capacity > 0 && summary.peak.expected >= capacity ? 'danger' : undefined,
      },
      {
        label: 'Exécutions planifiées',
        value: String(summary.runCount),
        hint: `${this.planning.scheduledJobs().length} jobs planifiés`,
      },
      {
        label: 'Risque de saturation',
        value: riskTime > 0 ? formatDuration(riskTime) : 'Aucun',
        hint: riskTime > 0 ? `${risks.length} période(s) au niveau de la capacité` : 'la capacité devrait suffire',
        tone: riskTime > 0 ? 'warn' : 'idle',
      },
      {
        label: 'Prochaine fenêtre calme',
        value: quiet ? formatDuration(quiet.duration) : '—',
        hint: quiet ? `${formatShortDate(quiet.start)} · ${formatRange(quiet.start, quiet.end)}` : `aucune de ${this.settings().maintenanceDurationHours} h`,
        tone: quiet ? 'idle' : undefined,
      },
      {
        label: 'Fiabilité',
        value: backtest ? `± ${backtest.meanAbsoluteError.toFixed(1)}` : '—',
        hint: backtest ? 'erreur moyenne sur la semaine passée' : 'il faut 2 semaines d’historique',
      },
    ];
  });

  protected readonly upcomingRuns = computed(() =>
    this.store
      .runs()
      .filter((run) => run.start >= this.store.window().start)
      .slice(0, UPCOMING_RUNS_SHOWN)
      .map((run) => ({
        key: `${run.jobName}-${run.start}`,
        jobName: run.jobName,
        when: formatDateTime(run.start),
        duration: formatDuration(run.end - run.start),
      })),
  );

  protected readonly quietList = computed(() =>
    this.store.quietWindows().map((w) => ({
      key: w.start,
      day: formatShortDate(w.start),
      range: formatRange(w.start, w.end),
      duration: formatDuration(w.duration),
    })),
  );

  protected readonly riskList = computed(() =>
    this.store.saturationRisks().map((w) => ({
      key: w.start,
      day: formatShortDate(w.start),
      range: formatRange(w.start, w.end),
      duration: formatDuration(w.duration),
    })),
  );

  ngOnInit(): void {
    this.planning.ensureLoaded();
  }

  protected horizonLabel(days: number): string {
    return days === 1 ? '24 h' : `${days} jours`;
  }
}
