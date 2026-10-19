import { TimeWindow } from '../time-window';

/** Les cinq champs d'une ligne cron Jenkins, dans l'ordre. */
export type CronFieldName = 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek';

/**
 * Donne la valeur d'un symbole `H` : Jenkins le remplace par une valeur
 * stable, dérivée du nom du job, comprise dans [min, max].
 */
export type HashResolver = (field: CronFieldName, min: number, max: number) => number;

/** Une ligne cron, développée en ensembles de valeurs autorisées. */
export interface CronSchedule {
  /** Texte des cinq champs, après remplacement des alias (`@daily`…). */
  readonly fields: readonly string[];
  readonly minutes: readonly number[];
  readonly hours: readonly number[];
  readonly daysOfMonth: readonly number[];
  readonly months: readonly number[];
  /** 0 = dimanche … 6 = samedi, comme en cron. */
  readonly daysOfWeek: readonly number[];
}

export class CronSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CronSyntaxError';
  }
}

const FIELDS: readonly { name: CronFieldName; min: number; max: number }[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'dayOfMonth', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'dayOfWeek', min: 0, max: 7 },
];

/** Alias Jenkins : ils utilisent `H` pour étaler la charge. */
const ALIASES: Readonly<Record<string, string>> = {
  '@yearly': 'H H H H *',
  '@annually': 'H H H H *',
  '@monthly': 'H H H * *',
  '@weekly': 'H H * * H',
  '@daily': 'H H * * *',
  '@midnight': 'H H(0-2) * * *',
  '@hourly': 'H * * * *',
};

const TERM = /^(\*|H(?:\((\d+)-(\d+)\))?|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/;

/**
 * Lit une planification Jenkins (champ « Build periodically »), qui peut
 * compter plusieurs lignes. Les commentaires et la ligne `TZ=` sont ignorés.
 */
export function parseJenkinsCron(spec: string, resolveHash: HashResolver): CronSchedule[] {
  return spec
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter((line) => line !== '' && !/^TZ=/i.test(line))
    .map((line) => parseLine(line, resolveHash));
}

function parseLine(line: string, resolveHash: HashResolver): CronSchedule {
  const expanded = ALIASES[line.toLowerCase()] ?? line;
  const fields = expanded.split(/\s+/);
  if (fields.length !== 5) {
    throw new CronSyntaxError(`« ${line} » : 5 champs attendus, ${fields.length} trouvés.`);
  }
  const [minutes, hours, daysOfMonth, months, rawDaysOfWeek] = fields.map((text, i) =>
    parseField(text, FIELDS[i], resolveHash),
  );
  // Dimanche s'écrit 0 ou 7.
  const daysOfWeek = [...new Set(rawDaysOfWeek.map((d) => d % 7))].sort((a, b) => a - b);
  return { fields, minutes, hours, daysOfMonth, months, daysOfWeek };
}

function parseField(
  text: string,
  field: (typeof FIELDS)[number],
  resolveHash: HashResolver,
): number[] {
  const values = new Set<number>();
  for (const term of text.split(',')) {
    const match = TERM.exec(term);
    if (!match) throw new CronSyntaxError(`Terme « ${term} » invalide (${field.name}).`);
    const [, head, hashFrom, hashTo, from, to, stepText] = match;
    const step = stepText === undefined ? null : Number(stepText);
    if (step !== null && step <= 0) throw new CronSyntaxError(`Pas nul dans « ${term} ».`);

    // `H` sur le jour de semaine porte sur 0-6 (pas de 7 en double).
    const fieldMax = field.name === 'dayOfWeek' && head.startsWith('H') ? 6 : field.max;
    let low: number;
    let high: number;
    if (head === '*') {
      [low, high] = [field.min, fieldMax];
    } else if (head.startsWith('H')) {
      [low, high] = hashFrom === undefined ? [field.min, fieldMax] : [Number(hashFrom), Number(hashTo)];
    } else {
      low = Number(from);
      high = to === undefined ? (step === null ? low : fieldMax) : Number(to);
    }
    if (low < field.min || high > field.max || low > high) {
      throw new CronSyntaxError(`« ${term} » sort de l'intervalle ${field.min}-${field.max}.`);
    }

    if (head.startsWith('H')) {
      // `H` seul : une valeur. `H/n` : une valeur de départ dans [low, low+n-1], puis tous les n.
      const start = resolveHash(field.name, low, step === null ? high : Math.min(high, low + step - 1));
      if (step === null) values.add(start);
      else for (let v = start; v <= high; v += step) values.add(v);
    } else {
      for (let v = low; v <= high; v += step ?? 1) values.add(v);
    }
  }
  return [...values].sort((a, b) => a - b);
}

/** Jenkins exige que tous les champs correspondent (y compris jour du mois ET jour de semaine). */
function matchesDay(schedule: CronSchedule, date: Date): boolean {
  return (
    schedule.months.includes(date.getMonth() + 1) &&
    schedule.daysOfMonth.includes(date.getDate()) &&
    schedule.daysOfWeek.includes(date.getDay())
  );
}

/** Instants de déclenchement (heure locale) compris dans la fenêtre, triés. */
export function cronOccurrences(schedule: CronSchedule, window: TimeWindow): number[] {
  const times: number[] = [];
  const day = new Date(window.start);
  day.setHours(0, 0, 0, 0);
  for (; day.getTime() < window.end; day.setDate(day.getDate() + 1)) {
    if (!matchesDay(schedule, day)) continue;
    for (const hour of schedule.hours) {
      for (const minute of schedule.minutes) {
        const time = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute).getTime();
        if (time >= window.start && time < window.end) times.push(time);
      }
    }
  }
  return times;
}

/** Nombre moyen de déclenchements par semaine (indicatif). */
export function weeklyRunCount(schedule: CronSchedule): number {
  const perDay = schedule.hours.length * schedule.minutes.length;
  const dayShare =
    (schedule.daysOfWeek.length / 7) *
    (schedule.daysOfMonth.length / 31) *
    (schedule.months.length / 12);
  return perDay * 7 * dayShare;
}

/** Hachage FNV-1a : stable, pour remplacer `H` quand l'historique ne dit rien. */
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

