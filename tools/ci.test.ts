import { existsSync, readFileSync } from 'fs';
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
    expect(android).toMatch(/script: bash tools\/parcours-android\.sh/);
    expect(readFileSync(join(__dirname, 'parcours-android.sh'), 'utf8')).toMatch(/adb install/);
    expect(android).toMatch(/needs: apk/);
  });

  it("prévoit l'émulateur Android, lancé sur chaque demande de fusion et à la demande", () => {
    const android = lire('android.yml');
    expect(android).toMatch(/workflow_dispatch:/);
    expect(android).toMatch(/pull_request:/);
    expect(android).toMatch(/android-emulator-runner/);
    expect(android).toMatch(/maestro/i);
  });

  it('réessaie le téléchargement de Maestro et vérifie son installation (#49)', () => {
    const android = lire('android.yml');
    const etape = android.slice(
      android.indexOf('Installer Maestro'),
      android.indexOf('android-emulator-runner'),
    );
    expect(etape).toMatch(/for tentative in/);
    expect(etape).toMatch(/\.maestro\/bin\/maestro" --version/);
  });

  it('réessaie le téléchargement de Gradle avant de construire l’APK (#49)', () => {
    const android = lire('android.yml');
    const etape = android.slice(
      android.indexOf('Télécharger Gradle'),
      android.indexOf('Construire l'),
    );
    expect(etape).toMatch(/for tentative in/);
    expect(etape).toMatch(/\.\/gradlew --version --no-daemon/);
    expect(etape).toMatch(/working-directory: android/);
    expect(android.indexOf('Télécharger Gradle')).toBeLessThan(android.indexOf('assembleRelease'));
  });

  it('garde Gradle en cache et se replie sur les versions GitHub de Gradle (#49)', () => {
    const android = lire('android.yml');
    const cache = android.slice(
      android.indexOf('Cache de Gradle'),
      android.indexOf('Télécharger Gradle'),
    );
    expect(cache).toMatch(/actions\/cache@v4/);
    expect(cache).toMatch(/~\/\.gradle\/wrapper\/dists/);
    expect(cache).toMatch(/hashFiles\('android\/gradle\/wrapper\/gradle-wrapper\.properties'\)/);
    expect(android.indexOf('Projet Android natif')).toBeLessThan(
      android.indexOf('Cache de Gradle'),
    );
    const etape = android.slice(
      android.indexOf('Télécharger Gradle'),
      android.indexOf('Construire l'),
    );
    expect(etape).toMatch(/gradle-wrapper\.properties/);
    expect(etape).toMatch(/github\.com\/gradle\/gradle-distributions\/releases\/download/);
  });

  it("active l'horloge de test dans l'APK de développement, et seulement là (#49)", () => {
    const android = lire('android.yml');
    const apk = android.slice(android.indexOf('Construire l'), android.indexOf('upload-artifact'));
    expect(apk).toMatch(/EXPO_PUBLIC_HORLOGE_TEST: '1'/);
    expect(android.match(/EXPO_PUBLIC_HORLOGE_TEST/g)).toHaveLength(1);
    expect(lire('ci.yml')).not.toMatch(/EXPO_PUBLIC_HORLOGE_TEST/);
    for (const fichier of ['app.json', 'package.json', 'eas.json'])
      if (existsSync(join(__dirname, '..', fichier)))
        expect(readFileSync(join(__dirname, '..', fichier), 'utf8')).not.toMatch(
          /EXPO_PUBLIC_HORLOGE_TEST/,
        );
  });

  it('ne dépend ni de secret ni de service payant', () => {
    expect(ci + lire('android.yml')).not.toMatch(/secrets\./);
  });
});
