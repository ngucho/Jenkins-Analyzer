import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { MAX_SHIFT_OPTIONS, OptimizationStore } from '@application/optimization.store';
import { PlanningStore } from '@application/planning.store';
import { analyzeMovability } from '@domain/planning/daily-pattern';
import { weeklyRunCount } from '@domain/planning/jenkins-cron';
import { LoadMetrics } from '@domain/planning/load-grid';
import { PROFILE_SLOT, WEEK } from '@domain/planning/weekly-profile';
import { CopyButton } from '../../components/copy-button/copy-button';
import { PlanningStatus } from '../../components/planning-status/planning-status';
import { Stat, StatGrid } from '../../components/stat-grid/stat-grid';
import { ChartSeries } from '../../components/time-series-chart/chart.model';
import { TimeSeriesChart } from '../../components/time-series-chart/time-series-chart';
import { formatDuration, formatShift, formatTimesOfDay } from '../../shared/format';

@Component({
  selector: 'app-optimize-page',
  imports: [PlanningStatus, StatGrid, TimeSeriesChart, CopyButton],
  templateUrl: './optimize.page.html',
  styleUrls: ['../planning-page.scss', './optimize.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptimizePage implements OnInit {
  protected readonly planning = inject(PlanningStore);
  protected readonly store = inject(OptimizationStore);
  protected readonly shiftOptions = MAX_SHIFT_OPTIONS;
  protected readonly slotSize = PROFILE_SLOT;

  protected readonly week = computed(() => {
    const start = this.store.referenceWeekStart();
    return { start, end: start + WEEK };
  });

  protected readonly series = computed<ChartSeries[]>(() => {
    const result = this.store.result();
    if (!result) return [];
    return [
      { label: 'Après', kind: 'area', tone: 'accent', values: result.after },
      { label: 'Avant', kind: 'line', tone: 'muted', values: result.before },
    ];
  });

  protected readonly stats = computed<Stat[]>(() => {
    const result = this.store.result();
    if (!result) return [];
    const { metricsBefore: before, metricsAfter: after } = result;
    const movable = this.planning.scheduledJobs().length - result.fixedJobs.length;
    return [
      compare('Pic de charge attendu', before, after, (m) => m.peak, (v) => v.toFixed(1)),
      compare('Temps au-delà de la capacité', before, after, (m) => m.saturatedHours, (v) => `${v.toFixed(1)} h`),
      compare('Irrégularité (écart-type)', before, after, (m) => m.stdDev, (v) => v.toFixed(2)),
      {
        label: 'Jobs à décaler',
        value: String(result.changes.length),
        hint: `sur ${movable} déplaçable(s) · ${this.planning.scheduledJobs().length} planifié(s)`,
        tone: result.changes.length > 0 ? 'idle' : undefined,
      },
    ];
  });

  protected readonly changes = computed(() =>
    (this.store.result()?.changes ?? []).map((change) => ({
      ...change,
      fromTimes: formatTimesOfDay(change.from.minute, change.from.hours),
      toTimes: formatTimesOfDay(change.to.minute, change.to.hours),
      shift: formatShift(change.shiftMinutes),
    })),
  );

  protected readonly jobs = computed(() => {
    const fixed = new Map((this.store.result()?.fixedJobs ?? []).map((f) => [f.jobName, f.reason]));
    return this.planning.scheduledJobs().map((job) => {
      const movability = analyzeMovability(job);
      return {
        jobName: job.jobName,
        spec: job.spec,
        duration: job.durationKnown ? formatDuration(job.duration) : `${formatDuration(job.duration)} (supposée)`,
        perWeek: Math.round(job.schedules.reduce((s, schedule) => s + weeklyRunCount(schedule), 0)),
        locked: this.store.locked().has(job.jobName),
        lockable: movability.movable,
        status: movability.movable ? (fixed.get(job.jobName) ?? 'Déplaçable') : movability.reason,
        approximate: !job.hashFromHistory && job.spec.includes('H'),
      };
    });
  });

  ngOnInit(): void {
    this.planning.ensureLoaded();
  }
}

function compare(
  label: string,
  before: LoadMetrics,
  after: LoadMetrics,
  pick: (m: LoadMetrics) => number,
  format: (v: number) => string,
): Stat {
  const gain = pick(before) - pick(after);
  return {
    label,
    value: `${format(pick(before))} → ${format(pick(after))}`,
    hint: gain > 1e-6 ? `amélioration de ${format(gain)}` : 'inchangé',
    tone: gain > 1e-6 ? 'idle' : undefined,
  };
}
