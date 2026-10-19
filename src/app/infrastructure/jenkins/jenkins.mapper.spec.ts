import { flattenJobTree, toBuild, toTrigger } from './jenkins.mapper';

describe('jenkins.mapper', () => {
  it('aplatit dossiers et multibranch en chemins d’API', () => {
    const jobs = flattenJobTree([
      { _class: 'hudson.model.FreeStyleProject', name: 'solo', url: 'u1' },
      {
        _class: 'com.cloudbees.hudson.plugins.folder.Folder',
        name: 'team a',
        url: 'u2',
        jobs: [{ _class: 'WorkflowJob', name: 'feature/x', url: 'u3' }],
      },
    ]);
    expect(jobs).toEqual([
      { fullName: 'solo', apiPath: 'job/solo/', url: 'u1' },
      { fullName: 'team a/feature/x', apiPath: 'job/team%20a/job/feature%2Fx/', url: 'u3' },
    ]);
  });

  it('prolonge un build en cours jusqu’à maintenant', () => {
    const build = toBuild(
      { number: 7, timestamp: 1000, duration: 0, estimatedDuration: 50, result: null, building: true, url: 'b' },
      'job',
      5000,
    );
    expect(build).toEqual(jasmine.objectContaining({ start: 1000, end: 5000, result: 'RUNNING', node: null }));
  });

  it('normalise le nœud built-in et les résultats inconnus', () => {
    const build = toBuild(
      { number: 1, timestamp: 0, duration: 10, estimatedDuration: 10, result: 'WEIRD', building: false, builtOn: '', url: 'b' },
      'job',
      0,
    );
    expect(build.node).toBe('built-in');
    expect(build.result).toBe('UNKNOWN');
  });
});

describe('toTrigger', () => {
  it('reconnaît les principales causes Jenkins', () => {
    const cause = (cls: string) => [{ _class: 'hudson.model.CauseAction', causes: [{ _class: cls }] }];
    expect(toTrigger(cause('hudson.triggers.TimerTrigger$TimerTriggerCause'))).toBe('timer');
    expect(toTrigger(cause('hudson.triggers.SCMTrigger$SCMTriggerCause'))).toBe('scm');
    expect(toTrigger(cause('jenkins.branch.BranchIndexingCause'))).toBe('scm');
    expect(toTrigger(cause('hudson.model.Cause$UserIdCause'))).toBe('user');
    expect(toTrigger(cause('hudson.model.Cause$UpstreamCause'))).toBe('upstream');
    expect(toTrigger(cause('org.example.CustomCause'))).toBe('other');
    expect(toTrigger([{ _class: 'hudson.plugins.git.util.BuildData' }])).toBe('unknown');
  });
});
