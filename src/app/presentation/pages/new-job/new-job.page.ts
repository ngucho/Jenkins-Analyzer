import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DEFAULT_NEW_JOB, NewJobStore } from '@application/new-job.store';
import { PlanningStore } from '@application/planning.store';
import { NewJobRequest, Recurrence, SlotSuggestion } from '@domain/planning/slot-finder';
import { PROFILE_SLOT, WEEK } from '@domain/planning/weekly-profile';
import { MINUTE } from '@domain/time-window';
import { CopyButton } from '../../components/copy-button/copy-button';
import { PlanningStatus } from '../../components/planning-status/planning-status';
import { ChartBar, ChartSeries } from '../../components/time-series-chart/chart.model';
import { TimeSeriesChart } from '../../components/time-series-chart/time-series-chart';
import { formatDateTime, formatHour, formatMinuteOfDay, WEEKDAY_NAMES } from '../../shared/format';

type RecurrenceKind = Recurrence['kind'];

const RECURRENCES: readonly { kind: RecurrenceKind; label: string }[] = [
  { kind: 'daily', label: 'Chaque jour' },
  { kind: 'workdays', label: 'Du lundi au vendredi' },
  { kind: 'weekly', label: 'Une fois par semaine' },
  { kind: 'every-hours', label: 'Toutes les N heures' },
  { kind: 'once', label: 'Une seule fois' },
];

const EVERY_HOURS = [2, 3, 4, 6, 8, 12];

@Component({
  selector: 'app-new-job-page',
  imports: [ReactiveFormsModule, PlanningStatus, TimeSeriesChart, CopyButton],
  templateUrl: './new-job.page.html',
  styleUrls: ['../planning-page.scss', './new-job.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewJobPage implements OnInit {
  protected readonly planning = inject(PlanningStore);
  protected readonly store = inject(NewJobStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly recurrences = RECURRENCES;
  protected readonly everyHours = EVERY_HOURS;
  protected readonly weekdays = WEEKDAY_NAMES;
  protected readonly hours = Array.from({ length: 24 }, (_, h) => ({ value: h, label: formatHour(h) }));
  protected readonly slotSize = PROFILE_SLOT;

  protected readonly form = inject(NonNullableFormBuilder).group({
    durationMinutes: [DEFAULT_NEW_JOB.durationMinutes, [Validators.required, Validators.min(1), Validators.max(24 * 60)]],
    kind: ['daily' as RecurrenceKind],
    weekday: [0],
    everyHours: [4],
    from: [DEFAULT_NEW_JOB.allowedHours.from],
    to: [DEFAULT_NEW_JOB.allowedHours.to],
  });

  protected readonly kind = computed(() => this.store.request().recurrence.kind);

  protected readonly results = computed(() => {
    const request = this.store.request();
    const capacity = this.planning.capacity();
    return this.store.suggestions().map((s, index) => ({
      key: `${s.start}`,
      best: index === 0,
      label: describe(s, request.recurrence),
      cron: s.cron,
      existing: s.existingLoad.toFixed(1),
      peak: s.peakWithJob.toFixed(1),
      saturates: capacity > 0 && s.peakWithJob > capacity,
    }));
  });

  /** Aperçu : semaine type (récurrent) ou prochains jours (ponctuel), avec le meilleur créneau. */
  protected readonly preview = computed(() => {
    const request = this.store.request();
    const [best] = this.store.suggestions();
    const duration = request.durationMinutes * MINUTE;

    if (request.recurrence.kind === 'once') {
      const window = this.store.oneOffWindow();
      const bars: ChartBar[] = best
        ? [{ id: 'best', start: best.start, end: best.start + duration, label: 'Créneau recommandé', tone: 'idle' }]
        : [];
      const series: ChartSeries[] = [
        { label: 'Charge attendue', kind: 'area', tone: 'accent', values: this.store.oneOffForecast().map((p) => p.expected) },
      ];
      return { window, tickFormat: 'datetime' as const, series, bars, title: 'Prochains jours' };
    }

    const start = this.store.referenceWeekStart();
    const grid = this.store.weekGrid();
    const series: ChartSeries[] = grid
      ? [{ label: 'Charge actuelle', kind: 'area', tone: 'accent', values: Array.from(grid) }]
      : [];
    const bars: ChartBar[] = this.store.bestStarts().map((minute) => ({
      id: `best-${minute}`,
      start: start + minute * MINUTE,
      end: start + minute * MINUTE + duration,
      label: 'Nouveau job (créneau recommandé)',
      tone: 'idle',
    }));
    return { window: { start, end: start + WEEK }, tickFormat: 'weekday' as const, series, bars, title: 'Semaine type' };
  });

  ngOnInit(): void {
    this.planning.ensureLoaded();
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.form.valid) this.store.request.set(this.toRequest());
    });
    this.form.patchValue(fromRequest(this.store.request()), { emitEvent: false });
  }

  private toRequest(): NewJobRequest {
    const value = this.form.getRawValue();
    const recurrence: Recurrence =
      value.kind === 'weekly'
        ? { kind: 'weekly', weekday: Number(value.weekday) }
        : value.kind === 'every-hours'
          ? { kind: 'every-hours', hours: Number(value.everyHours) }
          : { kind: value.kind };
    return {
      durationMinutes: value.durationMinutes,
      recurrence,
      allowedHours: { from: Number(value.from), to: Number(value.to) },
    };
  }
}

function fromRequest(request: NewJobRequest) {
  const r = request.recurrence;
  return {
    durationMinutes: request.durationMinutes,
    kind: r.kind,
    weekday: r.kind === 'weekly' ? r.weekday : 0,
    everyHours: r.kind === 'every-hours' ? r.hours : 4,
    from: request.allowedHours.from,
    to: request.allowedHours.to,
  };
}

function describe(suggestion: SlotSuggestion, recurrence: Recurrence): string {
  const time = formatMinuteOfDay(suggestion.start);
  switch (recurrence.kind) {
    case 'once':
      return formatDateTime(suggestion.start);
    case 'daily':
      return `Chaque jour à ${time}`;
    case 'workdays':
      return `Du lundi au vendredi à ${time}`;
    case 'weekly':
      return `Chaque ${WEEKDAY_NAMES[recurrence.weekday]} à ${time}`;
    case 'every-hours':
      return `Toutes les ${recurrence.hours} h, à partir de ${time}`;
  }
}
