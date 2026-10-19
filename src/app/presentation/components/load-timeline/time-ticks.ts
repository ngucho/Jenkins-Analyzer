import { DAY, HOUR, MINUTE, TimeWindow, windowDuration } from '@domain/time-window';
import { formatShortDate, formatTime } from '../../shared/format';

export interface TimeTick {
  readonly time: number;
  readonly label: string;
  /** Début de journée : mis en avant sur l'axe. */
  readonly major: boolean;
}

const STEPS = [
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
];

/** Graduations alignées sur l'heure locale, environ `maxTicks` sur la fenêtre. */
export function timeTicks(window: TimeWindow, maxTicks: number): TimeTick[] {
  const step =
    STEPS.find((s) => windowDuration(window) / s <= maxTicks) ?? STEPS[STEPS.length - 1];
  const alignment = Math.min(step, DAY);
  const offset = new Date(window.start).getTimezoneOffset() * MINUTE;
  const first = Math.ceil((window.start - offset) / alignment) * alignment + offset;

  const ticks: TimeTick[] = [];
  for (let time = first; time <= window.end; time += step) {
    const date = new Date(time);
    const major = date.getHours() === 0 && date.getMinutes() === 0;
    ticks.push({ time, major, label: major || step >= DAY ? formatShortDate(time) : formatTime(time) });
  }
  return ticks;
}
