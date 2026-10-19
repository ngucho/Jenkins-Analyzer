import { DAY, HOUR, MINUTE } from '@domain/time-window';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it('formate selon l’ordre de grandeur', () => {
    expect(formatDuration(42_000)).toBe('42 s');
    expect(formatDuration(12 * MINUTE)).toBe('12 min');
    expect(formatDuration(HOUR + 5 * MINUTE)).toBe('1 h 05');
    expect(formatDuration(2 * DAY + 4 * HOUR)).toBe('2 j 4 h');
  });

  it('ne produit jamais « 60 minutes »', () => {
    expect(formatDuration(2 * HOUR - 10_000)).toBe('2 h');
  });
});
