/**
 * Lanceur de Jenkins Analyzer (version installée, ex. sur un NAS).
 *
 * Sert l'application sur http://localhost:<PORT> et relaie /jenkins-proxy/* vers
 * Jenkins pour éviter les blocages CORS. Aucune dépendance : Node.js suffit.
 * Ce n'est pas un backend : aucune donnée n'est stockée ni transformée.
 *
 * Configuration : fichier .env à côté de ce script (voir .env.example).
 * Options : --open (ouvre le navigateur).
 */
import { exec } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(HERE, 'app');
const PROXY_PREFIX = '/jenkins-proxy';

const envFile = join(HERE, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT || 4300);
const JENKINS_URL = (process.env.JENKINS_URL || '').trim().replace(/\/+$/, '');
const INSECURE = process.env.JENKINS_INSECURE === 'true';
const APP_URL = `http://localhost:${PORT}/`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(APP_DIR, 'index.html'))) {
  console.error(`Application introuvable dans ${APP_DIR}. Lancez « npm run package » pour la construire.`);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const url = request.url ?? '/';
  if (url === PROXY_PREFIX || url.startsWith(`${PROXY_PREFIX}/`)) {
    proxyToJenkins(request, response, url.slice(PROXY_PREFIX.length) || '/');
  } else {
    serveStatic(url, response);
  }
});

function serveStatic(url, response) {
  const pathname = decodeURIComponent(url.split('?')[0]);
  const requested = resolve(APP_DIR, normalize(`.${pathname}`));
  // Refuse toute sortie du dossier de l'application (../).
  if (requested !== APP_DIR && !requested.startsWith(APP_DIR + sep)) {
    response.writeHead(403).end();
    return;
  }
  const isFile = existsSync(requested) && statSync(requested).isFile();
  // Routes de l'application (ex. /forecast) : on renvoie index.html.
  const file = isFile ? requested : join(APP_DIR, 'index.html');
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const cache = file.endsWith('index.html') || file.endsWith('app-config.json') ? 'no-cache' : 'public, max-age=31536000, immutable';
  response.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
  createReadStream(file).pipe(response);
}

function proxyToJenkins(request, response, path) {
  if (!JENKINS_URL) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('JENKINS_URL n’est pas défini dans le fichier .env du lanceur.');
    return;
  }
  const target = new URL(JENKINS_URL + path);
  const client = target.protocol === 'https:' ? https : http;
  const headers = { ...request.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;

  const upstream = client.request(
    target,
    { method: request.method, headers, rejectUnauthorized: !INSECURE, timeout: 60_000 },
    (jenkins) => {
      response.writeHead(jenkins.statusCode ?? 502, jenkins.headers);
      jenkins.pipe(response);
    },
  );
  upstream.on('timeout', () => upstream.destroy(new Error('délai dépassé')));
  upstream.on('error', (error) => {
    console.error(`[jenkins-proxy] ${request.method} ${path} : ${error.message}`);
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Jenkins injoignable (${error.message}).`);
  });
  request.pipe(upstream);
}

function openBrowser() {
  const command =
    process.platform === 'win32' ? `start "" "${APP_URL}"` : process.platform === 'darwin' ? `open "${APP_URL}"` : `xdg-open "${APP_URL}"`;
  exec(command, () => {});
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    // Probablement déjà lancé sur ce poste : on ouvre simplement l'application.
    console.log(`Le port ${PORT} est déjà utilisé : Jenkins Analyzer tourne sans doute déjà. Ouverture de ${APP_URL}`);
    if (process.argv.includes('--open')) openBrowser();
    console.log('(Pour un autre port, définissez PORT=… dans le fichier .env.)');
    setTimeout(() => process.exit(0), 500);
  } else {
    console.error(error);
    process.exit(1);
  }
});

// Écoute uniquement en local : le relais vers Jenkins n'est pas exposé au réseau.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Jenkins Analyzer : ${APP_URL}`);
  console.log(
    JENKINS_URL
      ? `Proxy Jenkins     : ${PROXY_PREFIX}/* -> ${JENKINS_URL}${INSECURE ? ' (certificat non vérifié)' : ''}`
      : 'Proxy Jenkins     : désactivé (JENKINS_URL absent du fichier .env)',
  );
  console.log('Laissez cette fenêtre ouverte pendant l’utilisation ; fermez-la pour arrêter.');
  if (process.argv.includes('--open')) openBrowser();
});
