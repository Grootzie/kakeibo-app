import { execFileSync } from 'child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fr } from '../src/i18n/fr';
import { texteDuRappel } from '../src/state/rappel';

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

  it('ne ferme pas le clavier : « hideKeyboard » envoie « Retour », qui ferme la feuille', () => {
    expect(parcours).not.toMatch(/^- hideKeyboard/m);
  });

  it('prend une capture de la feuille et du message « Annuler »', () => {
    expect(parcours).toContain('- takeScreenshot: captures/noter-depense');
    expect(parcours).toContain('- takeScreenshot: captures/depense-notee');
  });
});

describe('parcours Maestro « Clôturer ma journée » (#45)', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'cloturer-journee.yaml'), 'utf8');

  it('ouvre E4 depuis l’accueil, ajoute une dépense oubliée, puis clôture', () => {
    expect(parcours).toMatch(/appId: app\.kakeibo/);
    expect(parcours).toContain(`- tapOn: '${fr.accueil.cloturerJournee}'`);
    expect(parcours).toContain(`- assertVisible: '${fr.cloture.rienDepense}'`);
    expect(parcours).toContain(`- tapOn: '${fr.cloture.ajouterOubliee}'`);
    expect(parcours).toContain(`- tapOn: '${fr.depense.categorieLibelle('Culture')}'`);
    expect(parcours).toContain(`- tapOn: '${fr.cloture.toutNote}'`);
    expect(parcours).toContain(`visible: '${fr.accueil.journeeCloturee}'`);
    expect(fr.cloture.depense(840, 'Culture', '')).toMatch(/^8,40.€ en Culture$/);
    expect(fr.cloture.totalCategorie('Culture', 840)).toMatch(/^Culture.: 8,40.€$/);
    expect(fr.accueil.caseLibelle('2026-11-06', 'cloturee')).toMatch(/^.*, clôturé$/);
  });

  it('ne ferme pas le clavier et prend les quatre captures', () => {
    expect(parcours).not.toMatch(/^- hideKeyboard/m);
    for (const nom of ['cloturer-rien-depense', 'cloturer-tout-note', 'tampon', 'journee-cloturee'])
      expect(parcours).toContain(`- takeScreenshot: captures/${nom}`);
  });

  it('efface les données à la fin : une clôture ne s’annule pas, les autres parcours en ont besoin', () => {
    expect(parcours.trimEnd()).toMatch(/- launchApp:\n {4}clearState: true$/);
  });
});

describe('parcours Maestro « Rattraper un jour » (#46)', () => {
  const dossier = join(__dirname, '..', 'e2e', 'heure');
  const installer = readFileSync(join(dossier, 'installer.yaml'), 'utf8');
  const parcours = readFileSync(join(dossier, 'rattraper-jour.yaml'), 'utf8');

  it('installe l’appli un mercredi, sans clôturer', () => {
    expect(installer).toMatch(/appId: app\.kakeibo/);
    expect(installer).toContain(
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'a_cloturer')}'`,
    );
    expect(installer).not.toMatch(/tapOn/);
  });

  it('le lendemain, la case est à rattraper, le bandeau ouvre E5, le tampon se pose', () => {
    expect(parcours).toContain(
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'rattrapable')}'`,
    );
    expect(fr.accueil.caseLibelle('2026-11-04', 'rattrapable')).toBe('mercredi, à rattraper');
    expect(parcours).toContain("- tapOn: 'Tu peux encore rattraper mercredi.4.novembre\\.'");
    expect(fr.accueil.bandeauRattraper('2026-11-04')).toMatch(
      /^Tu peux encore rattraper mercredi.4.novembre\.$/,
    );
    expect(parcours).toContain("- assertVisible: 'Rattraper mercredi.4.novembre'");
    expect(fr.cloture.titreRattrapage('2026-11-04')).toMatch(/^Rattraper mercredi.4.novembre$/);
    expect(parcours).toContain(`- tapOn: '${fr.cloture.rienDepense}'`);
    expect(parcours).toContain(`visible: '${fr.accueil.caseLibelle('2026-11-04', 'cloturee')}'`);
    for (const nom of ['rattraper-accueil', 'rattraper-jour', 'rattraper-cloture'])
      expect(parcours).toContain(`- takeScreenshot: captures/${nom}`);
    expect(parcours.trimEnd()).toMatch(/- launchApp:\n {4}clearState: true$/);
  });

  it('n’est pas joué avec les autres : il a besoin d’une heure précise', () => {
    expect(existsSync(join(__dirname, '..', 'e2e', 'rattraper-jour.yaml'))).toBe(false);
  });
});

describe('parcours Maestro « Rappel du soir » (#47)', () => {
  const dossier = join(__dirname, '..', 'e2e', 'heure');
  const installer = readFileSync(join(dossier, 'rappel-installer.yaml'), 'utf8');
  const parcours = readFileSync(join(dossier, 'rappel-toucher.yaml'), 'utf8');

  it('installe l’appli le jeudi 5 novembre avant 21:00, puis la passe en arrière-plan', () => {
    expect(installer).toMatch(/appId: app\.kakeibo/);
    expect(installer).toContain('notifications: allow');
    expect(installer).toContain(
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-05', 'a_cloturer')}'`,
    );
    expect(installer.trimEnd()).toMatch(/- pressKey: Home$/);
  });

  it('touche le rappel du jour, qui ouvre E4, puis pose le tampon', () => {
    const texte = texteDuRappel('2026-11-05');
    expect(texte).toMatch(/^Deux minutes pour clôturer ta journée.\?$/);
    expect(parcours).toContain("- tapOn: 'Deux minutes pour clôturer ta journée.\\?'");
    expect(parcours).toContain(`visible: '${fr.cloture.rienDepense}'`);
    expect(parcours).toContain(`- assertVisible: '${fr.cloture.titre}'`);
    expect(parcours).toContain(`- tapOn: '${fr.cloture.rienDepense}'`);
    expect(parcours).toContain(
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-05', 'cloturee')}'`,
    );
    for (const nom of ['rappel-notification', 'rappel-cloture', 'rappel-journee-cloturee'])
      expect(parcours).toContain(`- takeScreenshot: captures/${nom}`);
    expect(parcours.trimEnd()).toMatch(/- launchApp:\n {4}clearState: true$/);
  });
});

describe('script de l’émulateur (#52)', () => {
  const script = join(__dirname, 'parcours-android.sh');

  /** Joue le script avec de faux adb et maestro ; renvoie le code de sortie et le dossier. */
  function jouer(
    maestroReussit: boolean,
    heure = false,
    rappel = false,
  ): { code: number; dossier: string; journal: string } {
    const dossier = mkdtempSync(join(tmpdir(), 'parcours-'));
    const bin = join(dossier, 'bin');
    mkdirSync(bin);
    mkdirSync(join(dossier, 'e2e'));
    writeFileSync(join(dossier, 'e2e', 'accueil.yaml'), 'appId: app.kakeibo\n');
    if (heure) {
      mkdirSync(join(dossier, 'e2e', 'heure'));
      writeFileSync(join(dossier, 'e2e', 'heure', 'installer.yaml'), 'appId: app.kakeibo\n');
      if (rappel)
        writeFileSync(join(dossier, 'e2e', 'heure', 'rappel-toucher.yaml'), 'appId: app.kakeibo\n');
    }
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
        '  "shell dumpsys notification --noredact") echo "NotificationRecord pkg=app.kakeibo" ;;',
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

  it('règle l’heure du téléphone pour le parcours de rattrapage, puis la rend (#46)', () => {
    const { code, journal } = jouer(true, true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const position = (debut: string) => lignes.findIndex((l) => l.startsWith(debut));
    const racine = position('adb root');
    const efface = position('adb shell pm clear app.kakeibo');
    const mercredi = position('adb shell date 110409002026.00');
    const installer = position('maestro test e2e/heure/installer.yaml');
    const jeudi = position('adb shell date 110520002026.00');
    const rattraper = position('maestro test e2e/heure/rattraper-jour.yaml');
    const automatique = position('adb shell settings put global auto_time 1');
    expect(position('maestro test e2e ')).toBeLessThan(racine);
    expect([racine, efface, mercredi, installer, jeudi, rattraper, automatique]).toEqual(
      [racine, efface, mercredi, installer, jeudi, rattraper, automatique].sort((a, b) => a - b),
    );
    expect(racine).toBeGreaterThanOrEqual(0);
    expect(lignes[rattraper + 1]).toMatch(/^adb shell date \d{8}\d{4}\.\d{2}$/);
  });

  it('rappel du soir : 20:58, notifications accordées, attend le rappel, ouvre le volet (#47)', () => {
    const { code, journal } = jouer(true, true, true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const position = (debut: string) => lignes.findIndex((l) => l.startsWith(debut));
    const rattraper = position('maestro test e2e/heure/rattraper-jour.yaml');
    const efface = lignes.indexOf('adb shell pm clear app.kakeibo', rattraper);
    const accorde = position(
      'adb shell pm grant app.kakeibo android.permission.POST_NOTIFICATIONS',
    );
    const soir = position('adb shell date 110520582026.00');
    const installer = position('maestro test e2e/heure/rappel-installer.yaml');
    const attente = lignes.indexOf('adb shell dumpsys notification --noredact', installer);
    const volet = position('adb shell cmd statusbar expand-notifications');
    const toucher = position('maestro test e2e/heure/rappel-toucher.yaml');
    const automatique = position('adb shell settings put global auto_time 1');
    const ordre = [
      rattraper,
      efface,
      accorde,
      soir,
      installer,
      attente,
      volet,
      toucher,
      automatique,
    ];
    expect(Math.min(...ordre)).toBeGreaterThanOrEqual(0);
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
  });

  it('échoue si le parcours du rappel échoue', () => {
    const { code } = jouer(false, true, true);
    expect(code).toBe(1);
  });

  it('sans parcours à heure précise, ne touche pas à l’heure du téléphone', () => {
    const { journal } = jouer(true);
    expect(journal).not.toMatch(/adb shell date|adb root/);
  });

  it('échoue si le parcours de rattrapage échoue', () => {
    const { code } = jouer(false, true);
    expect(code).toBe(1);
  });
});
