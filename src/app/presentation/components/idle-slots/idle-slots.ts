import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IdleSlot } from '@domain/analytics/occupancy';
import { TimeWindow } from '@domain/time-window';
import { formatDuration, formatRange, formatShortDate } from '../../shared/format';

const MAX_SLOTS = 7;

/** Les plus longs trous d'activité observés ; un clic zoome dessus. */
@Component({
  selector: 'app-idle-slots',
  template: `
    @for (item of longestSlots(); track item.slot.start) {
      <button type="button" (click)="select.emit(item.slot)" title="Zoomer sur cette plage">
        <span class="day">{{ item.day }}</span>
        <span class="range">{{ item.range }}</span>
        <span class="duration">{{ item.duration }}</span>
      </button>
    } @empty {
      <p class="empty">Aucune plage creuse au-dessus du seuil sur cette période.</p>
    }
  `,
  styleUrl: './idle-slots.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdleSlots {
  readonly slots = input.required<readonly IdleSlot[]>();
  readonly select = output<TimeWindow>();

  protected readonly longestSlots = computed(() =>
    [...this.slots()]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, MAX_SLOTS)
      .map((slot) => ({
        slot,
        day: formatShortDate(slot.start),
        range: formatRange(slot.start, slot.end),
        duration: formatDuration(slot.duration),
      })),
  );
}
