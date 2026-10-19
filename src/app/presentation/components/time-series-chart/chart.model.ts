import { TimeWindow } from '@domain/time-window';

export type ChartTone = 'accent' | 'muted' | 'scheduled' | 'idle' | 'danger';

/** Une série de valeurs régulièrement espacées (une par créneau). */
export interface ChartSeries {
  readonly label: string;
  readonly values: readonly number[];
  readonly kind: 'area' | 'line';
  readonly tone: ChartTone;
}

/** Bande d'incertitude autour d'une prévision. */
export interface ChartBand {
  readonly label: string;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}

/** Zone verticale mise en évidence (plage calme, risque…). */
export interface ChartHighlight extends TimeWindow {
  readonly tone: ChartTone;
}

/** Exécution affichée sur une ligne sous la courbe. */
export interface ChartBar extends TimeWindow {
  readonly id: string;
  readonly label: string;
  readonly tone: ChartTone;
}

export type TickFormat = 'datetime' | 'weekday';
