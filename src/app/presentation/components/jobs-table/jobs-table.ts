import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { JobStats } from '@domain/analytics/job-stats';
import { DateTimePipe, DurationPipe, RatioPipe } from '../../shared/format.pipes';

type SortKey = keyof Pick<
  JobStats,
  'jobName' | 'runs' | 'averageDuration' | 'maxDuration' | 'totalDuration' | 'successRate' | 'lastStart'
>;

interface Column {
  readonly key: SortKey;
  readonly label: string;
  readonly numeric: boolean;
}

const COLUMNS: readonly Column[] = [
  { key: 'jobName', label: 'Job', numeric: false },
  { key: 'runs', label: 'Exécutions', numeric: true },
  { key: 'averageDuration', label: 'Durée moy.', numeric: true },
  { key: 'maxDuration', label: 'Durée max', numeric: true },
  { key: 'totalDuration', label: 'Temps cumulé', numeric: true },
  { key: 'successRate', label: 'Succès', numeric: true },
  { key: 'lastStart', label: 'Dernière exécution', numeric: true },
];

@Component({
  selector: 'app-jobs-table',
  imports: [DurationPipe, DateTimePipe, RatioPipe],
  templateUrl: './jobs-table.html',
  styleUrl: './jobs-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobsTable {
  readonly stats = input.required<readonly JobStats[]>();
  readonly jobSelected = output<string>();

  protected readonly columns = COLUMNS;
  protected readonly sortKey = signal<SortKey>('totalDuration');
  protected readonly descending = signal(true);

  protected readonly rows = computed(() => {
    const key = this.sortKey();
    const direction = this.descending() ? -1 : 1;
    return [...this.stats()].sort((a, b) => direction * compare(a[key], b[key]));
  });

  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.descending.update((d) => !d);
    } else {
      this.sortKey.set(key);
      this.descending.set(key !== 'jobName');
    }
  }
}

function compare(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return typeof a === 'string' ? a.localeCompare(b as string) : a - (b as number);
}
