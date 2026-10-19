import { Build, BuildResult } from '../build';
import { MINUTE } from '../time-window';
import { computeJobStats } from './job-stats';

function build(jobName: string, minutes: number, result: BuildResult, start = 0): Build {
  return { id: `${jobName}-${start}`, jobName, number: 1, start, end: start + minutes * MINUTE, result, node: null, trigger: 'unknown', url: '#' };
}

describe('computeJobStats', () => {
  it('agrège par job et trie par temps cumulé', () => {
    const stats = computeJobStats([
      build('a', 10, 'SUCCESS'),
      build('b', 30, 'FAILURE'),
      build('a', 20, 'FAILURE', 100),
      build('a', 5, 'RUNNING', 200),
    ]);

    expect(stats.map((s) => s.jobName)).toEqual(['a', 'b']);
    expect(stats[0]).toEqual(
      jasmine.objectContaining({
        runs: 3,
        totalDuration: 35 * MINUTE,
        maxDuration: 20 * MINUTE,
        successRate: 0.5,
        lastStart: 200,
      }),
    );
    expect(stats[1].shareOfBuildTime).toBeCloseTo(30 / 65);
  });
});
