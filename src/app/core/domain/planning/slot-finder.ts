import { MINUTE } from '../time-window';
import { ForecastPoint } from './forecast';
import { costOfAdding, forEachSlot, LoadGrid, slotCost } from './load-grid';
import { PROFILE_SLOT } from './weekly-profile';

/** Fréquence souhaitée pour le nouveau job. `weekday` : 0 = lundi. */
export type Recurrence =
  | { readonly kind: 'once' }
  | { readonly kind: 'daily' }
  | { readonly kind: 'workdays' }
  | { readonly kind: 'weekly'; readonly weekday: number }
  | { readonly kind: 'every-hours'; readonly hours: number };

export interface NewJobRequest {
  readonly durationMinutes: number;
  readonly recurrence: Recurrence;
  /** Heures de démarrage autorisées [from, to[ ; peut passer minuit (22 → 6). from = to : toute la journée. */
  readonly allowedHours: { readonly from: number; readonly to: number };
}

export interface SlotSuggestion {
  /** Récurrent : minute de la journée du premier départ. Ponctuel : timestamp. */
  readonly start: number;
  readonly cron: string | null;
  /** Charge déjà attendue, en moyenne, pendant l'exécution du job. */
  readonly existingLoad: number;
  /** Charge la plus haute atteinte avec le job. */
  readonly peakWithJob: number;
  /** Surcoût de charge (plus bas = meilleur). */
  readonly score: number;
}

const STEP_MINUTES = 15;
/** Marge examinée avant et après l'exécution : un job qui déborde un peu ne doit gêner personne. */
const MARGIN_MINUTES = 60;
/** Poids de la charge dans les marges, pour départager des créneaux équivalents. */
const MARGIN_WEIGHT = 0.25;
const MAX_SUGGESTIONS = 5;
const MIN_GAP_RECURRING = 60;
const MIN_GAP_ONCE = 120;

export function isAllowedHour(hour: number, allowed: NewJobRequest['allowedHours']): boolean {
  if (allowed.from === allowed.to) return true;
  return allowed.from < allowed.to
    ? hour >= allowed.from && hour < allowed.to
    : hour >= allowed.from || hour < allowed.to;
}

/**
 * Créneaux récurrents évalués sur la semaine type (charge habituelle + jobs
 * planifiés) : on cherche ceux qui ajoutent le moins de charge aux pics.
 */
export function suggestRecurringSlots(
  grid: LoadGrid,
  request: NewJobRequest,
  capacity: number,
): SlotSuggestion[] {
  const { recurrence, durationMinutes } = request;
  if (recurrence.kind === 'once') return [];

  const period = recurrence.kind === 'every-hours' ? recurrence.hours * 60 : 24 * 60;
  const candidates: SlotSuggestion[] = [];
  for (let first = 0; first < period; first += STEP_MINUTES) {
    if (recurrence.kind !== 'every-hours' && !isAllowedHour(Math.floor(first / 60), request.allowedHours)) {
      continue;
    }
    const starts = recurringStarts(recurrence, first);
    const score = starts.reduce(
      (s, start) =>
        s +
        costOfAdding(grid, start, durationMinutes, capacity) +
        MARGIN_WEIGHT * marginLoad(grid, start, durationMinutes),
      0,
    );
    candidates.push({
      start: first,
      cron: recurringCron(recurrence, first),
      score,
      ...loadDuring(grid, starts, durationMinutes),
    });
  }
  return pickDiverse(candidates, (a, b) => circularGap(a.start, b.start, period) < MIN_GAP_RECURRING);
}

/** Départs sur la semaine type (minutes depuis lundi 00:00). */
export function recurringStarts(recurrence: Recurrence, firstMinute: number): number[] {
  const days =
    recurrence.kind === 'workdays'
      ? [0, 1, 2, 3, 4]
      : recurrence.kind === 'weekly'
        ? [recurrence.weekday]
        : [0, 1, 2, 3, 4, 5, 6];
  const perDay =
    recurrence.kind === 'every-hours'
      ? Array.from(
          { length: Math.ceil((24 * 60 - firstMinute) / (recurrence.hours * 60)) },
          (_, k) => firstMinute + k * recurrence.hours * 60,
        )
      : [firstMinute];
  return days.flatMap((day) => perDay.map((minute) => day * 1440 + minute));
}

function recurringCron(recurrence: Recurrence, firstMinute: number): string {
  const minute = firstMinute % 60;
  const hour = Math.floor(firstMinute / 60);
  switch (recurrence.kind) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'workdays':
      return `${minute} ${hour} * * 1-5`;
    case 'weekly':
      return `${minute} ${hour} * * ${(recurrence.weekday + 1) % 7}`;
    case 'every-hours':
      return `${minute} ${hour}-23/${recurrence.hours} * * *`;
    case 'once':
      return '';
  }
}

/** Charge cumulée dans l'heure qui précède et celle qui suit l'exécution. */
function marginLoad(grid: LoadGrid, start: number, duration: number): number {
  let load = 0;
  const add = (slot: number, share: number) => (load += grid[slot] * share);
  forEachSlot(start - MARGIN_MINUTES, MARGIN_MINUTES, add);
  forEachSlot(start + duration, MARGIN_MINUTES, add);
  return load;
}

function loadDuring(grid: LoadGrid, starts: readonly number[], duration: number) {
  let weighted = 0;
  let total = 0;
  let peak = 0;
  for (const start of starts) {
    forEachSlot(start, duration, (slot, share) => {
      weighted += grid[slot] * share;
      total += share;
      peak = Math.max(peak, grid[slot] + share);
    });
  }
  return { existingLoad: total > 0 ? weighted / total : 0, peakWithJob: peak };
}

/** Exécution ponctuelle : on parcourt la prévision des prochains jours. */
export function suggestOneOffSlots(
  forecast: readonly ForecastPoint[],
  request: NewJobRequest,
  capacity: number,
  notBefore: number,
): SlotSuggestion[] {
  const slots = Math.max(1, Math.ceil((request.durationMinutes * MINUTE) / PROFILE_SLOT));
  const candidates: SlotSuggestion[] = [];
  for (let i = 0; i + slots <= forecast.length; i++) {
    const start = forecast[i].start;
    if (start < notBefore || !isAllowedHour(new Date(start).getHours(), request.allowedHours)) continue;
    const window = forecast.slice(i, i + slots);
    const marginSlots = (MARGIN_MINUTES * MINUTE) / PROFILE_SLOT;
    const margins = [
      ...forecast.slice(Math.max(0, i - marginSlots), i),
      ...forecast.slice(i + slots, i + slots + marginSlots),
    ];
    const score =
      window.reduce((s, p) => s + slotCost(p.expected + 1, capacity) - slotCost(p.expected, capacity), 0) +
      MARGIN_WEIGHT * margins.reduce((s, p) => s + p.expected, 0);
    candidates.push({
      start,
      cron: null,
      score,
      existingLoad: window.reduce((s, p) => s + p.expected, 0) / window.length,
      peakWithJob: Math.max(...window.map((p) => p.high + 1)),
    });
  }
  return pickDiverse(candidates, (a, b) => Math.abs(a.start - b.start) < MIN_GAP_ONCE * MINUTE);
}

/** Meilleurs candidats, en écartant ceux trop proches d'un candidat déjà retenu. */
function pickDiverse(
  candidates: SlotSuggestion[],
  tooClose: (a: SlotSuggestion, b: SlotSuggestion) => boolean,
): SlotSuggestion[] {
  const chosen: SlotSuggestion[] = [];
  for (const candidate of [...candidates].sort((a, b) => a.score - b.score || a.start - b.start)) {
    if (chosen.some((c) => tooClose(c, candidate))) continue;
    chosen.push(candidate);
    if (chosen.length === MAX_SUGGESTIONS) break;
  }
  return chosen;
}

function circularGap(a: number, b: number, period: number): number {
  const gap = Math.abs(a - b) % period;
  return Math.min(gap, period - gap);
}
