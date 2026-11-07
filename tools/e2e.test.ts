import { execFileSync } from 'child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fr } from '../src/i18n/fr';
import { texteDuRappel } from '../src/state/rappel';

/** Vérifie que chaque ligne figure dans le parcours, dans cet ordre (garde-fou #49). */
function dansLOrdre(parcours: string, lignes: string[]): void {
  let position = -1;
  for (const ligne of lignes) {
    const trouvee = parcours.indexOf(ligne, position + 1);
    if (trouvee < 0) throw new Error(`Étape absente ou déplacée : ${ligne}`);
    position = trouvee;
  }
}

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

describe('parcours Maestro « Cartes de première fois » (#48)', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'premieres-fois.yaml'), 'utf8');
  const rattraper = readFileSync(
    join(__dirname, '..', 'e2e', 'heure', 'rattraper-jour.yaml'),
    'utf8',
  );
  const t = fr.carteExplication.titres;

  it('part d’une appli effacée et la laisse effacée', () => {
    expect(parcours).toMatch(/^- launchApp:\n    clearState: true\n- extendedWaitUntil:/m);
    expect(parcours.trimEnd()).toMatch(/- launchApp:\n    clearState: true$/);
  });

  it('montre « Première dépense » puis « Premier tampon », chacune fermée, et plus après redémarrage', () => {
    for (const titre of [t.first_expense, t.first_stamp]) {
      expect(parcours).toContain(`visible: '${titre}'`);
      expect(parcours).toContain(`- assertNotVisible: '${titre}'`);
      expect(parcours).toContain(`- tapOn: 'Fermer l’explication .*${titre}.*'`);
      expect(fr.carteExplication.fermerLibelle(titre)).toMatch(
        new RegExp(`^Fermer l’explication .*${titre}.*$`),
      );
    }
    expect(parcours).toContain('- takeScreenshot: captures/carte-premiere-depense');
    expect(parcours).toContain('- takeScreenshot: captures/carte-premier-tampon');
    expect(parcours.indexOf('- stopApp')).toBeLessThan(
      parcours.lastIndexOf(`- assertNotVisible: '${t.first_stamp}'`),
    );
  });

  it('montre « Premier jour à rattraper » sur l’accueil du jour oublié', () => {
    expect(rattraper).toContain(`- assertVisible: '${t.first_catch_up}'`);
    expect(rattraper).toContain('- takeScreenshot: captures/carte-premier-jour-a-rattraper');
    expect(fr.explications.premierJourARattraper).toMatch(/^Tu as oublié de clôturer un soir.*$/);
  });
});

describe('parcours Maestro « journée type » (J2, #49)', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'heure', 'journee-type.yaml'), 'utf8');
  const t = fr.carteExplication.titres;
  // Budget de démonstration : 600 € par mois de 30 jours, 20 € par jour décompté.
  // Installation le mercredi 4 novembre 2026 : 5 jours décomptés, 100 € pour la semaine.
  const reste = (centimes: number) => fr.accueil.reste(centimes, 'dimanche');

  it('le garde-fou refuse un parcours dont une étape manque ou a changé de place', () => {
    expect(() => dansLOrdre('- a\n- b\n', ['- a', '- b'])).not.toThrow();
    expect(() => dansLOrdre('- a\n', ['- a', '- b'])).toThrow('- b');
    expect(() => dansLOrdre('- b\n- a\n', ['- a', '- b'])).toThrow('- b');
  });

  it('calcule les montants attendus avec les textes de l’appli', () => {
    expect(reste(10000)).toMatch(/^Il te reste 100.€ jusqu’à dimanche$/);
    expect(reste(10000 - 1250)).toMatch(/^Il te reste 87,50.€ jusqu’à dimanche$/);
    expect(reste(10000 - 1250 - 840)).toMatch(/^Il te reste 79,10.€ jusqu’à dimanche$/);
    expect(fr.accueil.date('2026-11-04')).toMatch(/^mercredi.4.novembre$/);
    expect(fr.accueil.date('2026-11-05')).toMatch(/^jeudi.5.novembre$/);
    expect(fr.dev.budgetDemoLibelle).toMatch(/^Poser un budget de démonstration.*$/);
    expect(fr.dev.plusUnJour).toBe('+1 jour');
  });

  it('1. pose le budget de démonstration avec l’horloge de test : 100 € jusqu’à dimanche', () => {
    expect(parcours).toMatch(/appId: app\.kakeibo/);
    dansLOrdre(parcours, [
      '- launchApp',
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'a_cloturer')}'`,
      "- longPressOn: 'mercredi.4.novembre'",
      `- tapOn: 'Poser un budget de démonstration.*'`,
      `- assertVisible: '${fr.dev.budgetDemoPose}'`,
      "- assertVisible: 'Il te reste 100.€ jusqu’à dimanche'",
      '- takeScreenshot: captures/journee-budget',
    ]);
  });

  it('2. note deux dépenses dans deux catégories : le reste baisse de 12,50 € puis de 8,40 €', () => {
    dansLOrdre(parcours, [
      "- assertVisible: 'Il te reste 100.€ jusqu’à dimanche'",
      `- tapOn: '${fr.accueil.noterDepense}'`,
      "- inputText: '12.50'",
      `- tapOn: '${fr.depense.categorieLibelle('Essentiel')}'`,
      `visible: '${t.first_expense}'`,
      `- tapOn: 'Fermer l’explication .*${t.first_expense}.*'`,
      "- assertVisible: 'Il te reste 87,50.€ jusqu’à dimanche'",
      `- tapOn: '${fr.accueil.noterDepense}'`,
      "- inputText: '8.40'",
      `- tapOn: '${fr.depense.categorieLibelle('Culture')}'`,
      "- assertVisible: 'Il te reste 79,10.€ jusqu’à dimanche'",
      '- takeScreenshot: captures/journee-depenses',
    ]);
    expect(parcours).not.toMatch(/^- hideKeyboard/m);
  });

  it('3. clôture avec « J’ai tout noté » : case clôturée, bouton « Journée clôturée »', () => {
    dansLOrdre(parcours, [
      "- assertVisible: 'Il te reste 79,10.€ jusqu’à dimanche'",
      `- tapOn: '${fr.accueil.cloturerJournee}'`,
      `- tapOn: '${fr.cloture.toutNote}'`,
      `visible: '${t.first_stamp}'`,
      `- tapOn: 'Fermer l’explication .*${t.first_stamp}.*'`,
      `- assertVisible: '${fr.accueil.journeeCloturee}'`,
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'cloturee')}'`,
      `- assertNotVisible: '${fr.accueil.cloturerJournee}'`,
      '- takeScreenshot: captures/journee-cloturee-mercredi',
    ]);
  });

  it('4. avance d’un jour et clôture avec « Rien dépensé aujourd’hui »', () => {
    dansLOrdre(parcours, [
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'cloturee')}'`,
      "- tapOn: '\\+1 jour'",
      "visible: 'jeudi.5.novembre'",
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-05', 'a_cloturer')}'`,
      "- assertVisible: 'Il te reste 79,10.€ jusqu’à dimanche'",
      `- tapOn: '${fr.accueil.cloturerJournee}'`,
      "- assertVisible: 'Aucune dépense notée ce jour\\.'",
      `- tapOn: '${fr.cloture.rienDepense}'`,
      `visible: '${fr.accueil.journeeCloturee}'`,
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-05', 'cloturee')}'`,
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'cloturee')}'`,
      '- takeScreenshot: captures/journee-cloturee-jeudi',
    ]);
    expect(fr.accueil.caseLibelle('2026-11-05', 'a_cloturer')).toBe(
      'jeudi, à clôturer aujourd’hui',
    );
  });

  it('efface les données à la fin', () => {
    expect(parcours.trimEnd()).toMatch(/- launchApp:\n {4}clearState: true$/);
  });
});

describe('parcours Maestro « rattrapage » (J2, #49)', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'heure', 'rattrapage.yaml'), 'utf8');
  const t = fr.carteExplication.titres;

  it('calcule les textes attendus avec ceux de l’appli', () => {
    expect(fr.accueil.bandeauRattraper('2026-11-04')).toMatch(
      /^Tu peux encore rattraper mercredi.4.novembre\.$/,
    );
    expect(fr.accueil.bandeauRattraper('2026-11-05')).toMatch(
      /^Tu peux encore rattraper jeudi.5.novembre\.$/,
    );
    expect(fr.cloture.titreRattrapage('2026-11-04')).toMatch(/^Rattraper mercredi.4.novembre$/);
    expect(fr.accueil.date('2026-11-09')).toMatch(/^lundi.9.novembre$/);
    expect(fr.accueil.date('2026-11-10')).toMatch(/^mardi.10.novembre$/);
  });

  it('1. avance d’un jour sans clôturer : bandeau et case oubliée apparaissent', () => {
    expect(parcours).toMatch(/appId: app\.kakeibo/);
    dansLOrdre(parcours, [
      '- launchApp',
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'a_cloturer')}'`,
      "- longPressOn: 'mercredi.4.novembre'",
      `- tapOn: 'Poser un budget de démonstration.*'`,
      "- tapOn: '\\+1 jour'",
      "visible: 'jeudi.5.novembre'",
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'rattrapable')}'`,
      "- assertVisible: 'Tu peux encore rattraper mercredi.4.novembre\\.'",
      `- assertVisible: '${t.first_catch_up}'`,
      `- tapOn: 'Fermer l’explication .*${t.first_catch_up}.*'`,
      '- takeScreenshot: captures/rattrapage-oubli',
    ]);
  });

  it('2. ouvre le rattrapage, vérifie le titre, clôture : la case passe à clôturée', () => {
    dansLOrdre(parcours, [
      '- takeScreenshot: captures/rattrapage-oubli',
      "- tapOn: 'Tu peux encore rattraper mercredi.4.novembre\\.'",
      "- assertVisible: 'Rattraper mercredi.4.novembre'",
      '- takeScreenshot: captures/rattrapage-ecran',
      `- tapOn: '${fr.cloture.rienDepense}'`,
      `visible: '${t.first_stamp}'`,
      `- tapOn: 'Fermer l’explication .*${t.first_stamp}.*'`,
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-04', 'cloturee')}'`,
      "- assertNotVisible: 'Tu peux encore rattraper.*'",
      '- takeScreenshot: captures/rattrapage-cloture',
    ]);
  });

  it('3. oublie jeudi, avance au lundi 9:00 (encore rattrapable), puis au mardi : plus rattrapable', () => {
    const apres = parcours.slice(parcours.indexOf('- takeScreenshot: captures/rattrapage-cloture'));
    // Quatre jours : du jeudi 5 au lundi 9 novembre, 9:00, avant le délai du lundi 12:00.
    const jusquAuLundi = apres.slice(0, apres.indexOf("visible: 'lundi.9.novembre'"));
    expect(jusquAuLundi.match(/^- tapOn: '\\\+1 jour'$/gm)).toHaveLength(4);
    dansLOrdre(apres, [
      "visible: 'lundi.9.novembre'",
      "- assertVisible: 'Tu peux encore rattraper jeudi.5.novembre\\.'",
      '- takeScreenshot: captures/rattrapage-lundi-matin',
      `- tapOn: '${fr.accueil.cloturerJournee}'`,
      `- tapOn: '${fr.cloture.rienDepense}'`,
      `visible: '${fr.accueil.journeeCloturee}'`,
      "- assertVisible: 'Tu peux encore rattraper jeudi.5.novembre\\.'",
      "- tapOn: '\\+1 jour'",
      "visible: 'mardi.10.novembre'",
      "- assertNotVisible: 'Tu peux encore rattraper.*'",
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-09', 'cloturee')}'`,
      `- assertVisible: '${fr.accueil.caseLibelle('2026-11-10', 'a_cloturer')}'`,
      '- takeScreenshot: captures/rattrapage-trop-tard',
    ]);
  });

  it('efface les données à la fin', () => {
    expect(parcours.trimEnd()).toMatch(/- launchApp:\n {4}clearState: true$/);
  });
});

describe('script de l’émulateur (#52)', () => {
  const script = join(__dirname, 'parcours-android.sh');

  /** Joue le script avec de faux adb et maestro ; renvoie le code de sortie et le dossier. */
  function jouer(
    /** Vrai : tous les parcours réussissent ; un nom de fichier : seul ce parcours échoue. */
    maestroReussit: boolean | string,
    heure = false,
    rappel = false,
    parcoursJ2 = false,
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
      if (parcoursJ2)
        for (const nom of ['journee-type.yaml', 'rattrapage.yaml'])
          writeFileSync(join(dossier, 'e2e', 'heure', nom), 'appId: app.kakeibo\n');
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
    faux(
      'maestro',
      typeof maestroReussit === 'string'
        ? `case "$*" in *${maestroReussit}*) exit 1 ;; esac\nexit 0`
        : maestroReussit
          ? 'exit 0'
          : 'exit 1',
    );
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

  it('journée type et rattrapage : appli effacée, mercredi 4 novembre 2026 à 9:00, puis heure rendue (#49)', () => {
    const { code, journal } = jouer(true, true, true, true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const position = (debut: string) => lignes.findIndex((l) => l.startsWith(debut));
    const toucher = position('maestro test e2e/heure/rappel-toucher.yaml');
    const journee = position('maestro test e2e/heure/journee-type.yaml');
    const rattrapage = position('maestro test e2e/heure/rattrapage.yaml');
    const automatique = position('adb shell settings put global auto_time 1');
    expect(Math.min(toucher, journee, rattrapage)).toBeGreaterThanOrEqual(0);
    expect([toucher, journee, rattrapage, automatique]).toEqual(
      [toucher, journee, rattrapage, automatique].sort((a, b) => a - b),
    );
    for (const parcours of [journee, rattrapage]) {
      expect(lignes[parcours - 2]).toBe('adb shell pm clear app.kakeibo');
      expect(lignes[parcours - 1]).toBe('adb shell date 110409002026.00');
    }
  });

  it('échoue si le parcours « journée type » ou « rattrapage » échoue, et joue l’autre (#49)', () => {
    for (const [echoue, autre] of [
      ['journee-type.yaml', 'rattrapage.yaml'],
      ['rattrapage.yaml', 'journee-type.yaml'],
    ]) {
      const { code, journal } = jouer(echoue, true, true, true);
      expect(code).toBe(1);
      expect(journal).toContain(`maestro test e2e/heure/${autre}`);
      expect(journal).toContain('adb shell settings put global auto_time 1');
    }
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
