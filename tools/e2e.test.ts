import { execFileSync } from 'child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fr } from '../src/i18n/fr';

describe('parcours Maestro de démarrage', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'accueil.yaml'), 'utf8');

  it("vérifie que l'accueil affiche le bouton « Noter une dépense »", () => {
    expect(parcours).toContain(`- assertVisible: '${fr.accueil.noterDepense}'`);
    expect(fr.accueil.noterDepense).toBe('Noter une dépense');
  });

  it('attend le bouton jusqu’à 60 s avant de le vérifier (#52)', () => {
    expect(parcours).toContain(
      `- extendedWaitUntil:\n    visible: '${fr.accueil.noterDepense}'\n    timeout: 60000\n- assertVisible:`,
    );
  });

  it('vérifie l’enveloppe et le bouton de clôture de l’accueil (#43)', () => {
    expect(parcours).toContain(`- assertVisible: '${fr.accueil.cloturerJournee}'`);
    expect(parcours).toContain("- assertVisible: 'Il te reste .* jusqu’à dimanche'");
    expect(fr.accueil.reste(0, 'dimanche')).toMatch(/^Il te reste .* jusqu’à dimanche$/);
  });

  it('lance l’appli et prend une capture', () => {
    expect(parcours).toMatch(/appId: app\.kakeibo/);
    expect(parcours).toMatch(/- launchApp/);
    expect(parcours).toMatch(/- takeScreenshot:/);
  });
});

describe('parcours Maestro « Noter une dépense » (#44)', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'noter-depense.yaml'), 'utf8');

  it('ouvre la feuille, enregistre en Envies, puis annule la dépense', () => {
    expect(parcours).toMatch(/appId: app\.kakeibo/);
    expect(parcours).toContain(`- tapOn: '${fr.accueil.noterDepense}'`);
    expect(parcours).toContain(`- tapOn: '${fr.depense.categorieLibelle('Envies')}'`);
    expect(parcours).toContain(`- tapOn: '${fr.depense.annulerLibelle}'`);
    expect(parcours).toContain(`- assertNotVisible: '${fr.depense.annuler}'`);
    expect(fr.depense.notee(1250, 'Envies')).toMatch(/^12,50.€ noté en Envies\.$/);
  });

  it('prend une capture de la feuille et du message « Annuler »', () => {
    expect(parcours).toContain('- takeScreenshot: captures/noter-depense');
    expect(parcours).toContain('- takeScreenshot: captures/depense-notee');
  });
});

describe('script de l’émulateur (#52)', () => {
  const script = join(__dirname, 'parcours-android.sh');

  /** Joue le script avec de faux adb et maestro ; renvoie le code de sortie et le dossier. */
  function jouer(maestroReussit: boolean): { code: number; dossier: string; journal: string } {
    const dossier = mkdtempSync(join(tmpdir(), 'parcours-'));
    const bin = join(dossier, 'bin');
    mkdirSync(bin);
    mkdirSync(join(dossier, 'e2e'));
    writeFileSync(join(dossier, 'e2e', 'accueil.yaml'), 'appId: app.kakeibo\n');
    const journal = join(dossier, 'journal.txt');
    const faux = (nom: string, corps: string) => {
      writeFileSync(
        join(bin, nom),
        `#!/usr/bin/env bash\necho "${nom} $*" >> "${journal}"\n${corps}\n`,
      );
      chmodSync(join(bin, nom), 0o755);
    };
    faux(
      'adb',
      [
        'case "$*" in',
        '  "shell dumpsys window") echo "mCurrentFocus=Window{1 u0 com.android.launcher3/.Launcher}" ;;',
        '  "exec-out screencap -p") printf "PNG" ;;',
        '  "shell settings put system font_scale 2.0") echo 2 > "$HOME/echelle" ;;',
        'esac',
      ].join('\n'),
    );
    faux('maestro', maestroReussit ? 'exit 0' : 'exit 1');
    faux('sleep', 'exit 0');
    let code = 0;
    try {
      execFileSync('bash', [script], {
        cwd: dossier,
        env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, APK: 'appli.apk', HOME: dossier },
        stdio: 'pipe',
      });
    } catch (erreur) {
      code = (erreur as { status: number }).status;
    }
    return { code, dossier, journal: readFileSync(journal, 'utf8') };
  }

  it('attend le lanceur, installe l’APK puis joue les parcours', () => {
    const { code, journal } = jouer(true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const lanceur = lignes.indexOf('adb shell dumpsys window');
    const installation = lignes.indexOf('adb install appli.apk');
    const maestro = lignes.findIndex((l) => l.startsWith('maestro test e2e'));
    expect(lanceur).toBeGreaterThanOrEqual(0);
    expect(installation).toBeGreaterThan(lanceur);
    expect(maestro).toBeGreaterThan(installation);
  });

  it('joint capture, hiérarchie et logcat même si le parcours échoue, et échoue', () => {
    const { code, dossier } = jouer(false);
    expect(code).toBe(1);
    expect(readFileSync(join(dossier, 'captures', 'ecran.png'), 'utf8')).toBe('PNG');
    expect(existsSync(join(dossier, 'captures', 'hierarchie.xml'))).toBe(true);
    expect(existsSync(join(dossier, 'captures', 'logcat.txt'))).toBe(true);
  });

  it('capture aussi l’accueil avec le texte agrandi à 200 %, puis revient à 100 % (#43)', () => {
    const { code, dossier, journal } = jouer(true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const agrandi = lignes.indexOf('adb shell settings put system font_scale 2.0');
    const relance = lignes.indexOf(
      'adb shell monkey -p app.kakeibo -c android.intent.category.LAUNCHER 1',
    );
    const retour = lignes.indexOf('adb shell settings put system font_scale 1.0');
    expect(agrandi).toBeGreaterThan(lignes.findIndex((l) => l.startsWith('maestro test e2e')));
    expect(relance).toBeGreaterThan(agrandi);
    expect(retour).toBeGreaterThan(relance);
    expect(readFileSync(join(dossier, 'captures', 'ecran-texte-200.png'), 'utf8')).toBe('PNG');
  });
});
