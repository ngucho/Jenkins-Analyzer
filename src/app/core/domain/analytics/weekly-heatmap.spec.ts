import { HOUR } from '../time-window';
import { computeWeeklyHeatmap, suggestMaintenanceWindows, WeeklyHeatmap } from './weekly-heatmap';

/** Lundi 6 janvier 2025, 00:00 heure locale. */
const MONDAY = new Date(2025, 0, 6).getTime();
const WEEK = 7 * 24 * HOUR;

function uniformHeatmap(load: number): WeeklyHeatmap {
  return Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: 24 }, (_, hour) => ({ weekday, hour, averageLoad: load, samples: 1 })),
  );
}

describe('computeWeeklyHeatmap', () => {
  it('moyenne la charge par jour et par heure', () => {
    const builds = [
      { start: MONDAY + 9 * HOUR, end: MONDAY + 10 * HOUR },
      { start: MONDAY + WEEK + 9 * HOUR, end: MONDAY + WEEK + 9.5 * HOUR },
    ];
    const heatmap = computeWeeklyHeatmap(builds, { start: MONDAY, end: MONDAY + 2 * WEEK });
    expect(heatmap[0][9]).toEqual({ weekday: 0, hour: 9, averageLoad: 0.75, samples: 2 });
    expect(heatmap[2][9].averageLoad).toBe(0);
  });

  it('laisse vides les créneaux non couverts par la période', () => {
    const heatmap = computeWeeklyHeatmap([], { start: MONDAY, end: MONDAY + 24 * HOUR });
    expect(heatmap[0][3].samples).toBe(1);
    expect(heatmap[1][3].averageLoad).toBeNull();
  });
});

describe('suggestMaintenanceWindows', () => {
  it('propose le créneau le moins chargé, y compris à cheval sur deux jours', () => {
    const cells = uniformHeatmap(2).map((row) => row.map((cell) => ({ ...cell })));
    cells[6][23] = { ...cells[6][23], averageLoad: 0 };
    cells[0][0] = { ...cells[0][0], averageLoad: 0 };

    const [best] = suggestMaintenanceWindows(cells, 2, 1);
    expect(best).toEqual({ weekday: 6, startHour: 23, durationHours: 2, averageLoad: 0 });
  });

  it('renvoie des créneaux qui ne se chevauchent pas', () => {
    const windows = suggestMaintenanceWindows(uniformHeatmap(1), 3, 3);
    const hours = windows.flatMap((w) => [0, 1, 2].map((i) => w.weekday * 24 + w.startHour + i));
    expect(new Set(hours).size).toBe(9);
  });
});
