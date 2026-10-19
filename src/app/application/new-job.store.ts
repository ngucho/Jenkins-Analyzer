import { computed, inject, Injectable, signal } from '@angular/core';
import { forecastLoad } from '@domain/planning/forecast';
import {
  NewJobRequest,
  recurringStarts,
  suggestOneOffSlots,
  suggestRecurringSlots,
} from '@domain/planning/slot-finder';
import { buildWeekGrid } from '@domain/planning/week-grid';
import { ceilToSlot, nextMonday } from '@domain/planning/weekly-profile';
import { DAY, HOUR } from '@domain/time-window';
import { PlanningStore } from './planning.store';

/** Une exécution ponctuelle est cherchée dans les 7 prochains jours. */
const ONE_OFF_HORIZON_DAYS = 7;

export const DEFAULT_NEW_JOB: NewJobRequest = {
  durationMinutes: 30,
  recurrence: { kind: 'daily' },
  allowedHours: { from: 0, to: 0 },
};

/** Conseil de planification pour un nouveau job. */
@Injectable({ providedIn: 'root' })
export class NewJobStore {
  private readonly planning = inject(PlanningStore);

  readonly request = signal<NewJobRequest>(DEFAULT_NEW_JOB);
  readonly referenceWeekStart = computed(() => nextMonday(this.planning.now()));

  /** Semaine type actuelle : charge habituelle + tous les jobs déjà planifiés. */
  readonly weekGrid = computed(() => {
    const profile = this.planning.profile();
    return profile ? buildWeekGrid(profile, this.planning.scheduledJobs(), this.referenceWeekStart()) : null;
  });

  readonly oneOffWindow = computed(() => {
    const start = ceilToSlot(this.planning.now());
    return { start, end: start + ONE_OFF_HORIZON_DAYS * DAY };
  });

  /** Prévision des prochains jours, pour une exécution ponctuelle. */
  readonly oneOffForecast = computed(() => {
    const profile = this.planning.profile();
    return profile ? forecastLoad(profile, this.planning.scheduledJobs(), this.oneOffWindow()) : [];
  });

  readonly suggestions = computed(() => {
    const request = this.request();
    const capacity = this.planning.capacity();
    if (request.recurrence.kind === 'once') {
      const notBefore = this.oneOffWindow().start + HOUR / 4;
      return suggestOneOffSlots(this.oneOffForecast(), request, capacity, notBefore);
    }
    const grid = this.weekGrid();
    return grid ? suggestRecurringSlots(grid, request, capacity) : [];
  });

  /** Départs du meilleur créneau sur la semaine type, pour l'aperçu graphique. */
  readonly bestStarts = computed(() => {
    const [best] = this.suggestions();
    const recurrence = this.request().recurrence;
    return best && recurrence.kind !== 'once' ? recurringStarts(recurrence, best.start) : [];
  });
}
