import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface Stat {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone?: 'idle' | 'warn' | 'danger';
}

/** Rangée de cartes d'indicateurs, commune à toutes les pages. */
@Component({
  selector: 'app-stat-grid',
  template: `
    @for (stat of stats(); track stat.label) {
      <div class="stat" [attr.data-tone]="stat.tone">
        <span class="label">{{ stat.label }}</span>
        <span class="value">{{ stat.value }}</span>
        <span class="hint" [title]="stat.hint">{{ stat.hint }}</span>
      </div>
    }
  `,
  styleUrl: './stat-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatGrid {
  readonly stats = input.required<readonly Stat[]>();
}
