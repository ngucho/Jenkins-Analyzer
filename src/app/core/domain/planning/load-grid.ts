import { MINUTE } from '../time-window';
import { PROFILE_SLOT, SLOTS_PER_WEEK, WeeklyProfile } from './weekly-profile';

const SLOT_MINUTES = PROFILE_SLOT / MINUTE;
export const MINUTES_PER_WEEK = SLOTS_PER_WEEK * SLOT_MINUTES;

/** Au-delà de la capacité, chaque build en trop coûte beaucoup plus cher. */
const SATURATION_PENALTY = 10;

/**
 * Charge d'une semaine type, par quart d'heure, vue comme circulaire :
 * une exécution qui déborde le dimanche soir se poursuit le lundi matin.
 */
export type LoadGrid = Float64Array;

export function gridFromProfile(profile: WeeklyProfile): LoadGrid {
  return Float64Array.from(profile.mean);
}

/** Ajoute (ou retire, `amount` < 0) une exécution, en minutes depuis lundi 00:00. */
export function addRun(grid: LoadGrid, startMinute: number, durationMinutes: number, amount = 1): void {
  forEachSlot(startMinute, durationMinutes, (slot, share) => {
    grid[slot] += amount * share;
  });
}

/** Parcourt les quarts d'heure couverts par une exécution, avec la part couverte de chacun. */
export function forEachSlot(
  startMinute: number,
  durationMinutes: number,
  visit: (slot: number, share: number) => void,
): void {
  let cursor = startMinute;
  const end = startMinute + durationMinutes;
  while (cursor < end) {
    const slotStart = Math.floor(cursor / SLOT_MINUTES) * SLOT_MINUTES;
    const slotEnd = Math.min(slotStart + SLOT_MINUTES, end);
    const slot = (((slotStart / SLOT_MINUTES) % SLOTS_PER_WEEK) + SLOTS_PER_WEEK) % SLOTS_PER_WEEK;
    visit(slot, (slotEnd - cursor) / SLOT_MINUTES);
    cursor = slotEnd;
  }
}

/**
 * Coût d'un niveau de charge : quadratique (pénalise les pics plus que la
 * moyenne, donc favorise l'étalement) et fortement pénalisé au-delà de la capacité.
 */
export function slotCost(load: number, capacity: number): number {
  const excess = capacity > 0 ? Math.max(0, load - capacity) : 0;
  return load * load + SATURATION_PENALTY * excess * excess;
}

/** Variation de coût si l'on ajoute une exécution (sans modifier la grille). */
export function costOfAdding(
  grid: LoadGrid,
  startMinute: number,
  durationMinutes: number,
  capacity: number,
  amount = 1,
): number {
  let delta = 0;
  forEachSlot(startMinute, durationMinutes, (slot, share) => {
    delta += slotCost(grid[slot] + amount * share, capacity) - slotCost(grid[slot], capacity);
  });
  return delta;
}

export interface LoadMetrics {
  /** Charge moyenne attendue la plus haute sur un quart d'heure. */
  readonly peak: number;
  /** Heures où la charge attendue dépasse la capacité. */
  readonly saturatedHours: number;
  /** Écart-type : plus il est bas, plus la charge est régulière. */
  readonly stdDev: number;
}

export function gridMetrics(grid: LoadGrid, capacity: number): LoadMetrics {
  const values = Array.from(grid);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const saturated = capacity > 0 ? values.filter((v) => v > capacity).length : 0;
  return {
    peak: Math.max(0, ...values),
    saturatedHours: (saturated * SLOT_MINUTES) / 60,
    stdDev: Math.sqrt(variance),
  };
}
