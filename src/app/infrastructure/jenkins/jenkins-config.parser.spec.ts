import { extractTimerSpecs } from './jenkins-config.parser';

describe('extractTimerSpecs', () => {
  it('lit la planification d’un job freestyle et d’un pipeline', () => {
    const freestyle = `<project><triggers><hudson.triggers.TimerTrigger><spec>H 2 * * *</spec></hudson.triggers.TimerTrigger></triggers></project>`;
    const pipeline = `<flow-definition><properties><org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers><hudson.triggers.TimerTrigger><spec>H H(0-3) * * 1-5</spec></hudson.triggers.TimerTrigger></triggers>
      </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty></properties></flow-definition>`;
    expect(extractTimerSpecs(freestyle)).toEqual(['H 2 * * *']);
    expect(extractTimerSpecs(pipeline)).toEqual(['H H(0-3) * * 1-5']);
  });

  it('ignore les jobs sans planification et le polling SCM', () => {
    const polling = `<project><triggers><hudson.triggers.SCMTrigger><spec>H/5 * * * *</spec></hudson.triggers.SCMTrigger></triggers></project>`;
    expect(extractTimerSpecs(polling)).toEqual([]);
    expect(extractTimerSpecs('<project/>')).toEqual([]);
  });

  it('retire les paramètres du Parameterized Scheduler', () => {
    const xml = `<project><triggers><org.jenkinsci.plugins.parameterizedscheduler.ParameterizedTimerTrigger>
      <parameterizedSpecification>H 3 * * * % ENV=prod</parameterizedSpecification>
      </org.jenkinsci.plugins.parameterizedscheduler.ParameterizedTimerTrigger></triggers></project>`;
    expect(extractTimerSpecs(xml)).toEqual(['H 3 * * *']);
  });
});
