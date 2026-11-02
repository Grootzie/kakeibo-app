import { readFileSync } from 'fs';
import { join } from 'path';

const lire = (fichier: string): string =>
  readFileSync(join(__dirname, '..', '.github', 'workflows', fichier), 'utf8');

describe('intégration continue', () => {
  const ci = lire('ci.yml');

  it('se lance sur chaque demande de fusion et sur main', () => {
    expect(ci).toMatch(/pull_request:/);
    expect(ci).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
  });

  it('vérifie les types, le lint et les tests', () => {
    expect(ci).toMatch(/npm run typecheck/);
    expect(ci).toMatch(/npm run lint/);
    expect(ci).toMatch(/npm test/);
  });

  it("prévoit l'émulateur Android, lancé à la demande", () => {
    const android = lire('android.yml');
    expect(android).toMatch(/workflow_dispatch:/);
    expect(android).toMatch(/android-emulator-runner/);
    expect(android).toMatch(/maestro/i);
  });

  it('ne dépend ni de secret ni de service payant', () => {
    expect(ci + lire('android.yml')).not.toMatch(/secrets\./);
  });
});
