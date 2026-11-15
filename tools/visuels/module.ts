// Module des visuels provisoires (J4.4) : chaque visuel, par son identifiant (`items/daruma/crack`),
// avec un `require` que Metro lit pour embarquer l'image et choisir sa densité (@2x, @3x).
import type { Catalog } from '../../src/domain/objets';
import { DOSSIER, listeVisuels } from './provisoires.ts';

/** Fichier généré, lu par le rendu de la maison. */
export const MODULE_VISUELS = 'src/ui/maison/visuelsProvisoires.ts';

/** Texte du module, avant mise en forme par Prettier. */
export function moduleVisuels(catalogue: Catalog): string {
  const lignes = listeVisuels(catalogue).map(
    (v) => `  '${v.chemin}': require('../../../${DOSSIER}/${v.chemin}.webp'),`,
  );
  return [
    '// Généré par tools/generer-visuels-provisoires.ts : ne le modifie pas à la main.',
    '// Visuels provisoires de la maison (J4.3), par identifiant : le rendu de la maison (J4.4) les',
    '// dessine. Le lot définitif aura son propre module, sans toucher au domaine ni aux écrans.',
    "import type { ImageRequireSource } from 'react-native';",
    '',
    'export const VISUELS_PROVISOIRES: Readonly<Record<string, ImageRequireSource>> = {',
    ...lignes,
    '};',
    '',
  ].join('\n');
}
