import { DAY, lastDays, TimeWindow } from '@domain/time-window';

export type PeriodId = '24h' | '7d' | '14d' | '30d';

export interface Period {
  readonly id: PeriodId;
  readonly label: string;
  readonly days: number;
}

export const PERIODS: readonly Period[] = [
  { id: '24h', label: '24 h', days: 1 },
  { id: '7d', label: '7 jours', days: 7 },
  { id: '14d', label: '14 jours', days: 14 },
  { id: '30d', label: '30 jours', days: 30 },
];

export function windowForPeriod(id: PeriodId, now = Date.now()): TimeWindow {
  const period = PERIODS.find((p) => p.id === id) ?? PERIODS[1];
  return lastDays(period.days, now);
}

export const MIN_ZOOM_DURATION = DAY / 96;
