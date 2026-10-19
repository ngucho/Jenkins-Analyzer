/**
 * Extrait les planifications d'un `config.xml` de job Jenkins :
 * « Build periodically » (TimerTrigger), y compris pour les pipelines
 * (déclarées via `triggers { cron(...) }`), et le plugin Parameterized Scheduler.
 */
export function extractTimerSpecs(xml: string): string[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) return [];

  const specs = textsOf(document, 'hudson.triggers.TimerTrigger', 'spec');
  // Parameterized Scheduler : « H 2 * * * % PARAM=valeur », une ligne par planification.
  const parameterized = textsOf(
    document,
    'org.jenkinsci.plugins.parameterizedscheduler.ParameterizedTimerTrigger',
    'parameterizedSpecification',
  ).map((text) =>
    text
      .split('\n')
      .map((line) => line.split('%')[0].trim())
      .join('\n'),
  );
  return [...specs, ...parameterized].map((spec) => spec.trim()).filter((spec) => spec !== '');
}

function textsOf(document: Document, triggerTag: string, childTag: string): string[] {
  return Array.from(document.getElementsByTagName(triggerTag)).flatMap((trigger) =>
    Array.from(trigger.getElementsByTagName(childTag)).map((node) => node.textContent ?? ''),
  );
}
