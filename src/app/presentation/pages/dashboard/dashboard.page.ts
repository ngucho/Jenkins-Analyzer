import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SettingsStore } from '@application/settings.store';
import { PERIODS } from '@application/period';
import { WorkloadStore } from '@application/workload.store';
import { IdleSlots } from '../../components/idle-slots/idle-slots';
import { JobsTable } from '../../components/jobs-table/jobs-table';
import { KpiStrip } from '../../components/kpi-strip/kpi-strip';
import { MaintenanceWindows } from '../../components/maintenance-windows/maintenance-windows';
import { LoadTimeline } from '../../components/load-timeline/load-timeline';
import { WeeklyHeatmapView } from '../../components/weekly-heatmap/weekly-heatmap';
import { formatDateTime, formatShortDate, formatTime } from '../../shared/format';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, KpiStrip, LoadTimeline, WeeklyHeatmapView, MaintenanceWindows, IdleSlots, JobsTable],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly store = inject(WorkloadStore);
  protected readonly settings = inject(SettingsStore).settings;
  protected readonly periods = PERIODS;

  protected readonly viewLabel = computed(() => {
    const window = this.store.viewWindow();
    return window
      ? `${formatShortDate(window.start)} ${formatTime(window.start)} → ${formatShortDate(window.end)} ${formatTime(window.end)}`
      : '';
  });

  protected readonly fetchedLabel = computed(() => {
    const snapshot = this.store.snapshot();
    return snapshot ? `Mis à jour ${formatDateTime(snapshot.fetchedAt)}` : '';
  });

  protected readonly warnings = computed(() => {
    const snapshot = this.store.snapshot();
    if (!snapshot) return [];
    const messages: string[] = [];
    if (snapshot.truncatedJobs.length > 0) {
      messages.push(
        `Historique incomplet pour ${snapshot.truncatedJobs.length} job(s) (limite de ${this.settings().maxBuildsPerJob} builds par job) : ${snapshot.truncatedJobs.slice(0, 3).join(', ')}…`,
      );
    }
    if (snapshot.failedJobs.length > 0) {
      messages.push(`Historique illisible pour ${snapshot.failedJobs.length} job(s) : ${snapshot.failedJobs.slice(0, 3).join(', ')}`);
    }
    return messages;
  });

  ngOnInit(): void {
    if (!this.store.snapshot() && !this.store.loading()) this.store.load();
  }

  protected onSearch(event: Event): void {
    this.store.jobFilter.set((event.target as HTMLInputElement).value);
  }
}
