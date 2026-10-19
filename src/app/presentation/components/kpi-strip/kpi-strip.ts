import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WorkloadSummary } from '@domain/analytics/workload-analysis';
import { formatDuration, formatPercent, formatRange, formatShortDate } from '../../shared/format';

interface Kpi {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone?: 'idle' | 'warn';
}

@Component({
  selector: 'app-kpi-strip',
  template: `
    @for (kpi of kpis(); track kpi.label) {
      <div class="kpi" [attr.data-tone]="kpi.tone">
        <span class="label">{{ kpi.label }}</span>
        <span class="value">{{ kpi.value }}</span>
        <span class="hint">{{ kpi.hint }}</span>
      </div>
    }
  `,
  styleUrl: './kpi-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiStrip {
  readonly summary = input.required<WorkloadSummary>();
  readonly capacity = input(0);

  protected readonly kpis = computed<Kpi[]>(() => {
    const s = this.summary();
    const longest = s.longestIdleSlot;
    return [
      {
        label: 'Builds',
        value: s.buildCount.toLocaleString('fr-FR'),
        hint: `${s.jobCount} jobs · ${formatPercent(s.failureRate)} d’échecs`,
      },
      {
        label: 'Taux d’occupation',
        value: formatPercent(s.occupancyRate),
        hint: `${formatDuration(s.busyTime)} avec au moins un build`,
        tone: s.occupancyRate > 0.8 ? 'warn' : undefined,
      },
      {
        label: 'Temps libre',
        value: formatDuration(s.idleTime),
        hint: 'aucun build en cours',
        tone: 'idle',
      },
      {
        label: 'Temps machine',
        value: formatDuration(s.cumulatedBuildTime),
        hint: 'somme des durées de build',
      },
      {
        label: 'Pic de concurrence',
        value: `${s.peakConcurrency}`,
        hint: this.capacity() > 0 ? `pour ${this.capacity()} exécuteurs en ligne` : 'builds simultanés',
        tone: this.capacity() > 0 && s.peakConcurrency >= this.capacity() ? 'warn' : undefined,
      },
      {
        label: 'Plus longue plage creuse',
        value: longest ? formatDuration(longest.duration) : '—',
        hint: longest
          ? `${formatShortDate(longest.start)} · ${formatRange(longest.start, longest.end)}`
          : 'aucune sur la période',
        tone: 'idle',
      },
    ];
  });
}
