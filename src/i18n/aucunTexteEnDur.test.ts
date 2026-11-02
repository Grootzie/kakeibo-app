import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function fichiers(dir: string, out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, out);
    else if (chemin.endsWith('.tsx')) out.push(chemin);
  }
  return out;
}

describe('textes visibles', () => {
  it('ne sont jamais écrits en dur dans les écrans', () => {
    const racine = join(__dirname, '..', '..');
    const ecrans = [...fichiers(join(racine, 'app')), ...fichiers(join(racine, 'src'))];
    expect(ecrans.length).toBeGreaterThan(0);
    ecrans.forEach((f) => {
      const source = readFileSync(f, 'utf8');
      // texte JSX littéral entre > et <
      expect({ f, trouve: source.match(/>\s*[A-Za-zÀ-ÿ][^<>{}]*</g) }).toEqual({
        f,
        trouve: null,
      });
      // attributs de texte en dur
      expect({ f, trouve: source.match(/accessibility(Label|Hint)="/g) }).toEqual({
        f,
        trouve: null,
      });
    });
  });
});
