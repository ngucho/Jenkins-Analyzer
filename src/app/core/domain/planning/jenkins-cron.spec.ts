import { HOUR } from '../time-window';
import { cronOccurrences, CronSyntaxError, parseJenkinsCron } from './jenkins-cron';

const fixedHash = () => (_field: string, min: number) => min;
/** Lundi 6 janvier 2025, 00:00 heure locale. */
const MONDAY = new Date(2025, 0, 6).getTime();

describe('parseJenkinsCron', () => {
  it('lit valeurs, plages, listes et pas', () => {
    const [s] = parseJenkinsCron('0,30 8-18/2 * * 1-5', fixedHash());
    expect(s.minutes).toEqual([0, 30]);
    expect(s.hours).toEqual([8, 10, 12, 14, 16, 18]);
    expect(s.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it('remplace H par la valeur du résolveur, dans la plage demandée', () => {
    const resolve = (field: string, min: number, max: number) =>
      field === 'minute' ? Math.min(max, min + 37) : Math.min(max, min + 2);
    const [s] = parseJenkinsCron('H H(1-4) * * *', resolve);
    expect(s.minutes).toEqual([37]);
    expect(s.hours).toEqual([3]);
  });

  it('gère H/n et les alias', () => {
    const resolve = (_f: string, min: number) => min + 7;
    expect(parseJenkinsCron('H/15 * * * *', resolve)[0].minutes).toEqual([7, 22, 37, 52]);
    const [daily] = parseJenkinsCron('@daily', (_f, min) => min);
    expect(daily.fields).toEqual(['H', 'H', '*', '*', '*']);
  });

  it('ignore commentaires et TZ, et accepte plusieurs lignes', () => {
    const schedules = parseJenkinsCron('TZ=Europe/Paris\n# nuit\nH 2 * * *\nH 14 * * 6', fixedHash());
    expect(schedules.length).toBe(2);
  });

  it('normalise le dimanche (7 → 0)', () => {
    expect(parseJenkinsCron('0 0 * * 7', fixedHash())[0].daysOfWeek).toEqual([0]);
  });

  it('rejette une syntaxe invalide', () => {
    expect(() => parseJenkinsCron('0 25 * * *', fixedHash())).toThrowError(CronSyntaxError);
    expect(() => parseJenkinsCron('0 2 * *', fixedHash())).toThrowError(CronSyntaxError);
  });
});

describe('cronOccurrences', () => {
  it('liste les déclenchements de la semaine, en heure locale', () => {
    const [s] = parseJenkinsCron('30 2 * * 1-5', fixedHash());
    const times = cronOccurrences(s, { start: MONDAY, end: MONDAY + 7 * 24 * HOUR });
    expect(times.length).toBe(5);
    expect(new Date(times[0]).getHours()).toBe(2);
    expect(new Date(times[0]).getMinutes()).toBe(30);
  });
});
