/**
 * Proxy du serveur de dev : contourne CORS en relayant /jenkins-proxy/* vers Jenkins.
 *
 * Configuration : copiez `.env.example` en `.env` et renseignez JENKINS_URL.
 * Une variable d'environnement déjà définie (ex. en CI) l'emporte sur le fichier.
 * Puis cochez « Passer par le proxy de développement » dans les paramètres.
 */
import { existsSync } from 'node:fs';

const ENV_FILE = '.env';
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const DEFAULT_TARGET = 'http://localhost:8080';
const target = process.env.JENKINS_URL?.trim().replace(/\/+$/, '') || DEFAULT_TARGET;

console.log(`[jenkins-proxy] /jenkins-proxy/* -> ${target}`);
if (target === DEFAULT_TARGET) {
  console.warn(
    '[jenkins-proxy] JENKINS_URL n’est pas défini : le proxy vise localhost:8080.\n' +
      '                Copiez .env.example en .env et renseignez JENKINS_URL, sinon ECONNREFUSED.',
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
