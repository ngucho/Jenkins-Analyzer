/**
 * Prépare la version installable (à copier sur un NAS ou un partage réseau) :
 *   dist/jenkins-analyzer/
 *   ├── app/                         application construite
 *   ├── serve.mjs                    lanceur sans dépendance
 *   ├── Lancer Jenkins Analyzer.bat  lanceur Windows
 *   ├── lancer.sh                    lanceur macOS / Linux
 *   ├── .env.example                 configuration du relais Jenkins
 *   └── LISEZMOI.txt
 * À exécuter après `ng build` (voir le script npm « package »).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'dist', 'jenkins-workload', 'browser');
const OUTPUT = join(ROOT, 'dist', 'jenkins-analyzer');
const LAUNCHER = join(ROOT, 'tools', 'launcher');

if (!existsSync(join(BUILD, 'index.html'))) {
  console.error('Build introuvable : lancez « npm run package » (il exécute ng build avant ce script).');
  process.exit(1);
}

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });
cpSync(BUILD, join(OUTPUT, 'app'), { recursive: true });
for (const file of ['serve.mjs', 'Lancer Jenkins Analyzer.bat', 'lancer.sh', 'LISEZMOI.txt']) {
  cpSync(join(LAUNCHER, file), join(OUTPUT, file));
}
cpSync(join(ROOT, '.env.example'), join(OUTPUT, '.env.example'));

console.log(`Version installable prête : ${OUTPUT}`);
console.log('Copiez ce dossier sur le NAS, ajoutez-y un .env (copie de .env.example) et, si besoin, app/app-config.json.');
