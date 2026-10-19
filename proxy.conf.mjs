/**
 * Proxy du serveur de dev : contourne CORS en relayant /jenkins-proxy/* vers Jenkins.
 * Usage : JENKINS_URL=https://jenkins.mon-entreprise.fr npm start
 * puis cocher « Passer par le proxy de développement » dans les paramètres.
 */
const target = process.env.JENKINS_URL ?? 'http://localhost:8080';

export default {
  '/jenkins-proxy': {
    target,
    changeOrigin: true,
    secure: process.env.JENKINS_INSECURE !== 'true',
    pathRewrite: { '^/jenkins-proxy': '' },
  },
};
