import { computed, inject, Injectable, signal } from '@angular/core';
import { optimizeSchedules } from '@domain/planning/schedule-optimizer';
import { nextMonday } from '@domain/planning/weekly-profile';
import { PlanningStore } from './planning.store';

export const MAX_SHIFT_OPTIONS = [1, 3, 6, 12] as const;
export type MaxShiftHours = (typeof MAX_SHIFT_OPTIONS)[number];

/**
 * Optimisation des planifications existantes. Le calcul est rapide (quelques
 * millisecondes) : il est refait à chaque changement de réglage.
 */
@Injectable({ providedIn: 'root' })
export class OptimizationStore {
  private readonly planning = inject(PlanningStore);

  readonly maxShiftHours = signal<MaxShiftHours>(3);
  readonly locked = signal<ReadonlySet<string>>(new Set());

  readonly referenceWeekStart = computed(() => nextMonday(this.planning.now()));

  readonly result = computed(() => {
    const profile = this.planning.profile();
    if (!profile) return null;
    return optimizeSchedules({
      profile,
      jobs: this.planning.scheduledJobs(),
      capacity: this.planning.capacity(),
      maxShiftMinutes: this.maxShiftHours() * 60,
      locked: this.locked(),
      referenceWeekStart: this.referenceWeekStart(),
    });
  });

  toggleLock(jobName: string): void {
    this.locked.update((locked) => {
      const next = new Set(locked);
      if (next.has(jobName)) next.delete(jobName);
      else next.add(jobName);
      return next;
    });
  }
}
