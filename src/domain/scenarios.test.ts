import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Garde-fou : chacun des 25 scénarios de la spec figure une seule fois dans les tests du domaine,
// avec son numéro dans le titre.
describe('les 25 scénarios de la spec', () => {
  const titres = readdirSync(__dirname)
    .filter((f) => f.endsWith('.test.ts') && f !== 'scenarios.test.ts')
    .flatMap((f) => {
      const source = readFileSync(join(__dirname, f), 'utf8');
      return [...source.matchAll(/test(?:\.todo)?\(\s*['"]sc[ée]nario (\d+) :/g)].map((m) =>
        Number(m[1]),
      );
    });

  it('sont tous présents, chacun une fois', () => {
    const attendus = Array.from({ length: 25 }, (_, i) => i + 1);
    expect([...titres].sort((a, b) => a - b)).toEqual(attendus);
  });
});
