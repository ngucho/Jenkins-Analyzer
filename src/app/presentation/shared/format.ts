import { DAY, HOUR, MINUTE, SECOND } from '@domain/time-window';

const LOCALE = 'fr-FR';

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
export const WEEKDAY_NAMES = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;

const time = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: '2-digit', month: '2-digit' });
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** « 2 j 4 h », « 1 h 05 », « 12 min », « 45 s ». */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return `${Math.round(ms / SECOND)} s`;
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} min`;
  if (ms < DAY) {
    // On arrondit d'abord à la minute pour éviter les « 1 h 60 ».
    const totalMinutes = Math.round(ms / MINUTE);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`;
  }
  const totalHours = Math.round(ms / HOUR);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0 ? `${days} j` : `${days} j ${hours} h`;
}

export function formatTime(ms: number): string {
  return time.format(ms);
}

export function formatShortDate(ms: number): string {
  return shortDate.format(ms);
}

export function formatDateTime(ms: number): string {
  return dateTime.format(ms);
}

export function formatPercent(ratio: number | null, digits = 0): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(digits)} %`;
}

export function formatHour(hour: number): string {
  return `${String(hour % 24).padStart(2, '0')}:00`;
}

/** « 14:00 → 16:30 », avec la date de fin si elle diffère. */
export function formatRange(start: number, end: number): string {
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  return sameDay
    ? `${formatTime(start)} → ${formatTime(end)}`
    : `${formatTime(start)} → ${formatShortDate(end)} ${formatTime(end)}`;
}
