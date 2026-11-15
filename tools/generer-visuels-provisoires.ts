// Génère les visuels provisoires de la maison (J4.3) dans assets/maison-provisoire, en WebP 1x, 2x
// et 3x, sans dépendance ni service en ligne. Les fichiers produits sont versionnés ; un test
// vérifie qu'ils correspondent toujours à ce script.
//
//   node --experimental-strip-types tools/generer-visuels-provisoires.ts
//
// À lancer depuis la racine du dépôt. Les fichiers du dossier sont remplacés, sauf LISEZMOI.md.
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import type { Catalog } from '../src/domain/objets';
import { DOSSIER, ECHELLES, fichierVisuel, listeVisuels } from './visuels/provisoires.ts';
import { encoderWebp } from './visuels/webp.ts';

const catalogue = JSON.parse(readFileSync('src/content/catalogue.json', 'utf8')) as Catalog;

for (const nom of readdirSync(DOSSIER, { withFileTypes: true }))
  if (nom.name !== 'LISEZMOI.md') rmSync(join(DOSSIER, nom.name), { recursive: true });

let total = 0;
let plusLourd = { chemin: '', poids: 0 };
for (const visuel of listeVisuels(catalogue)) {
  for (const echelle of ECHELLES) {
    const fichier = join(DOSSIER, fichierVisuel(visuel.chemin, echelle));
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, encoderWebp(visuel.dessiner(echelle)));
    const poids = statSync(fichier).size;
    total += poids;
    if (poids > plusLourd.poids) plusLourd = { chemin: fichier, poids };
  }
}
console.log(`${DOSSIER} : ${(total / 1024 / 1024).toFixed(2)} Mo`);
console.log(
  `Fichier le plus lourd : ${plusLourd.chemin} (${(plusLourd.poids / 1024).toFixed(1)} Ko)`,
);
