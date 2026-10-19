import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MaintenanceWindow } from '@domain/analytics/weekly-heatmap';
import { formatHour, WEEKDAY_NAMES } from '../../shared/format';

@Component({
  selector: 'app-maintenance-windows',
  template: `
    @for (item of items(); track item.key; let first = $first) {
      <div class="window" [class.best]="first">
        <span class="when">
          @if (first) {
            <span class="tag">Recommandé</span>
          }
          Chaque {{ item.day }}
        </span>
        <span class="range">{{ item.range }}</span>
        <span class="load" [class.zero]="item.load === 0">{{ item.loadLabel }}</span>
      </div>
    } @empty {
      <p class="empty">Pas assez d’historique pour proposer un créneau.</p>
    }
  `,
  styleUrl: './maintenance-windows.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceWindows {
  readonly windows = input.required<readonly MaintenanceWindow[]>();

  protected readonly items = computed(() =>
    this.windows().map((w) => ({
      key: `${w.weekday}-${w.startHour}`,
      day: WEEKDAY_NAMES[w.weekday],
      range: `${formatHour(w.startHour)} → ${formatHour(w.startHour + w.durationHours)}`,
      load: w.averageLoad,
      loadLabel: w.averageLoad === 0 ? 'Jamais occupé' : `${w.averageLoad.toFixed(2)} build moy.`,
    })),
  );
}
