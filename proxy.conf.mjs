/**
 * Proxy du serveur de dev : contourne CORS en relayant /jenkins-proxy/* vers Jenkins.
 *
 * Linux / macOS :  JENKINS_URL=https://jenkins.mon-entreprise.fr npm start
 * PowerShell    :  $env:JENKINS_URL="https://jenkins.mon-entreprise.fr"; npm start
 * cmd.exe       :  set JENKINS_URL=https://jenkins.mon-entreprise.fr&& npm start
 *
 * puis cocher « Passer par le proxy de développement » dans les paramètres.
 * JENKINS_INSECURE=true accepte un certificat auto-signé.
 */
const DEFAULT_TARGET = 'http://localhost:8080';
const target = process.env.JENKINS_URL?.trim().replace(/\/+$/, '') || DEFAULT_TARGET;

console.log(`[jenkins-proxy] /jenkins-proxy/* -> ${target}`);
if (target === DEFAULT_TARGET) {
  console.warn(
    '[jenkins-proxy] JENKINS_URL n’est pas défini : le proxy vise localhost:8080.\n' +
      '                Définissez-le avant « npm start » (voir proxy.conf.mjs), sinon ECONNREFUSED.',
  );
}

export default {
  '/jenkins-proxy': {
    target,
    changeOrigin: true,
    secure: process.env.JENKINS_INSECURE !== 'true',
    pathRewrite: { '^/jenkins-proxy': '' },
  },
};
