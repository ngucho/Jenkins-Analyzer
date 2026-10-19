import { HOUR, MINUTE } from '../time-window';
import { computeLoadSeries, pickBucketSize } from './load-series';

const at = (hours: number) => hours * HOUR;
const span = (from: number, to: number) => ({ start: at(from), end: at(to) });

describe('computeLoadSeries', () => {
  it('donne la charge moyenne et le pic par bucket', () => {
    const series = computeLoadSeries([span(0, 2), span(0.5, 1)], span(0, 2), HOUR);
    expect(series.map((p) => [p.averageLoad, p.peakLoad])).toEqual([
      [1.5, 2],
      [1, 1],
    ]);
  });

  it('ne compte pas deux builds enchaînés comme simultanés', () => {
    const [point] = computeLoadSeries([span(0, 1), span(1, 2)], span(0, 2), at(2));
    expect(point.peakLoad).toBe(1);
  });

  it('prend en compte les builds commencés avant la fenêtre', () => {
    const [point] = computeLoadSeries([span(-3, 1)], span(0, 2), at(2));
    expect(point.averageLoad).toBe(0.5);
  });
});

describe('pickBucketSize', () => {
  it('choisit une taille ronde', () => {
    expect(pickBucketSize(span(0, 24), 200)).toBe(10 * MINUTE);
  });
});
