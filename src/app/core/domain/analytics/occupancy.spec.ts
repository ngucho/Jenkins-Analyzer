import { HOUR, MINUTE } from '../time-window';
import { busyTime, findIdleSlots, mergeIntervals } from './occupancy';

const at = (hours: number) => hours * HOUR;
const span = (from: number, to: number) => ({ start: at(from), end: at(to) });

describe('occupancy', () => {
  it('fusionne les intervalles qui se chevauchent ou se touchent', () => {
    expect(mergeIntervals([span(3, 4), span(1, 2), span(1.5, 2.5), span(2.5, 3)])).toEqual([
      span(1, 4),
    ]);
  });

  it('calcule le temps occupé borné à la fenêtre', () => {
    expect(busyTime([span(-1, 1), span(2, 3)], span(0, 10))).toBe(at(2));
  });

  it('trouve les plages creuses au-dessus du seuil, bords de fenêtre compris', () => {
    const slots = findIdleSlots([span(2, 3), span(3.2, 5), span(8, 9)], span(0, 10), 30 * MINUTE);
    expect(slots.map(({ start, end }) => ({ start, end }))).toEqual([
      span(0, 2),
      span(5, 8),
      span(9, 10),
    ]);
  });

  it('considère toute la fenêtre comme creuse sans aucun build', () => {
    expect(findIdleSlots([], span(0, 4), MINUTE)).toEqual([{ ...span(0, 4), duration: at(4) }]);
  });
});
