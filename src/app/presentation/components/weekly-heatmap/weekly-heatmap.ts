import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HeatmapCell, MaintenanceWindow, WeeklyHeatmap } from '@domain/analytics/weekly-heatmap';
import { formatHour, WEEKDAY_LABELS, WEEKDAY_NAMES } from '../../shared/format';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOURS_PER_WEEK = 7 * 24;

@Component({
  selector: 'app-weekly-heatmap',
  templateUrl: './weekly-heatmap.html',
  styleUrl: './weekly-heatmap.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeeklyHeatmapView {
  readonly heatmap = input.required<WeeklyHeatmap>();
  readonly highlights = input<readonly MaintenanceWindow[]>([]);

  protected readonly hours = HOURS;
  protected readonly weekdays = WEEKDAY_LABELS;

  private readonly maxLoad = computed(() =>
    Math.max(0.01, ...this.heatmap().flat().map((cell) => cell.averageLoad ?? 0)),
  );

  /** Index hebdomadaires (0…167) couverts par une suggestion de maintenance. */
  private readonly highlighted = computed(() => {
    const hours = new Set<number>();
    for (const w of this.highlights()) {
      const first = w.weekday * 24 + w.startHour;
      for (let i = 0; i < w.durationHours; i++) hours.add((first + i) % HOURS_PER_WEEK);
    }
    return hours;
  });

  protected intensity(cell: HeatmapCell): number {
    return cell.averageLoad === null ? 0 : cell.averageLoad / this.maxLoad();
  }

  protected isHighlighted(cell: HeatmapCell): boolean {
    return this.highlighted().has(cell.weekday * 24 + cell.hour);
  }

  protected describe(cell: HeatmapCell): string {
    const slot = `${WEEKDAY_NAMES[cell.weekday]} ${formatHour(cell.hour)}–${formatHour(cell.hour + 1)}`;
    if (cell.averageLoad === null) return `${slot} : pas de données`;
    const samples = cell.samples > 1 ? ` (moyenne sur ${cell.samples} semaines)` : '';
    return `${slot} : ${cell.averageLoad.toFixed(2)} build(s) en moyenne${samples}`;
  }
}
