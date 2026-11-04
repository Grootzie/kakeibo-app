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

  it("exporte la version web, et l'intégration continue échoue si l'export échoue", () => {
    expect(ci).toMatch(/npm run export:web/);
    expect(ci).not.toMatch(/continue-on-error/);
    expect(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).toMatch(
      /"export:web": "expo export --platform web"/,
    );
  });

  it("construit un APK de développement sans compte avant de lancer l'émulateur", () => {
    const android = lire('android.yml');
    expect(android).toMatch(/expo prebuild --platform android/);
    expect(android).toMatch(/assembleRelease/);
    expect(android).toMatch(/adb install/);
    expect(android).toMatch(/needs: apk/);
  });

  it("prévoit l'émulateur Android, lancé sur chaque demande de fusion et à la demande", () => {
    const android = lire('android.yml');
    expect(android).toMatch(/workflow_dispatch:/);
    expect(android).toMatch(/pull_request:/);
    expect(android).toMatch(/android-emulator-runner/);
    expect(android).toMatch(/maestro/i);
  });

  it('ne dépend ni de secret ni de service payant', () => {
    expect(ci + lire('android.yml')).not.toMatch(/secrets\./);
  });
});
