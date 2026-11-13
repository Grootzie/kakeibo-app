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

  it('voit le jeton tomber dans la machine avec le tampon, avant la capture (J3.8, #74)', () => {
    const jeton = "- assertVisible: 'Machine à capsules.: un jeton tombe dans la fente\\.'";
    expect(fr.cloture.machineLibelle).toMatch(
      /^Machine à capsules.: un jeton tombe dans la fente\.$/,
    );
    expect(parcours).toContain(jeton);
    expect(parcours.indexOf(`- tapOn: '${fr.cloture.toutNote}'`)).toBeLessThan(
      parcours.indexOf(jeton),
    );
    expect(parcours.indexOf(jeton)).toBeLessThan(
      parcours.indexOf('- takeScreenshot: captures/tampon'),
    );
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

  it('E5 fait tomber le jeton dans la machine, avec une capture, avant le retour (J3.8, #74)', () => {
    const jeton = "- assertVisible: 'Machine à capsules.: un jeton tombe dans la fente\\.'";
    const toucher = parcours.indexOf(`- tapOn: '${fr.cloture.rienDepense}'`);
    expect(toucher).toBeGreaterThan(-1);
    expect(parcours.indexOf(jeton)).toBeGreaterThan(toucher);
    expect(parcours.indexOf('- takeScreenshot: captures/rattraper-jeton')).toBeGreaterThan(
      parcours.indexOf(jeton),
    );
    expect(parcours.indexOf('- takeScreenshot: captures/rattraper-jeton')).toBeLessThan(
      parcours.indexOf(`visible: '${fr.accueil.caseLibelle('2026-11-04', 'cloturee')}'`),
    );
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
      `visible: '${fr.dev.horlogeTitre}'`,
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
      `visible: '${fr.dev.horlogeTitre}'`,
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
      // La semaine de jeudi est scellée : son bilan (E6, J3.2) s'ouvre ; on revient sans le faire.
      `visible: '${fr.bilanSemaine.temps(1)}'`,
      `- tapOn: '${fr.bilan.retourLibelle}'`,
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
    /** Vrai : tous les parcours réussissent ; un nom de fichier : seul ce parcours échoue ; null : Maestro absent. */
    maestroReussit: boolean | string | null,
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
        for (const nom of [
          'journee-type.yaml',
          'rattrapage.yaml',
          'bilans-prets.yaml',
          'bilan-mois.yaml',
          'recapitulatif.yaml',
          'bilan-semaine.yaml',
        ])
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
    if (maestroReussit !== null)
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
    return {
      code,
      dossier,
      journal: existsSync(journal) ? readFileSync(journal, 'utf8') : '',
    };
  }

  it('échoue tout de suite, sans rien installer, si Maestro manque (#49)', () => {
    const { code, journal } = jouer(null, true, true, true);
    expect(code).not.toBe(0);
    expect(journal).not.toMatch(/adb install/);
  });

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

  it('bilans prêts : appli effacée, mercredi 4 novembre 2026 à 9:00, après le rattrapage (#61)', () => {
    const { code, journal } = jouer(true, true, true, true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const position = (debut: string) => lignes.findIndex((l) => l.startsWith(debut));
    const rattrapage = position('maestro test e2e/heure/rattrapage.yaml');
    const bilans = position('maestro test e2e/heure/bilans-prets.yaml');
    const automatique = position('adb shell settings put global auto_time 1');
    expect(rattrapage).toBeGreaterThanOrEqual(0);
    expect([rattrapage, bilans, automatique]).toEqual(
      [rattrapage, bilans, automatique].sort((a, b) => a - b),
    );
    expect(lignes[bilans - 2]).toBe('adb shell pm clear app.kakeibo');
    expect(lignes[bilans - 1]).toBe('adb shell date 110409002026.00');
  });

  it('bilan du mois : appli effacée, mercredi 4 novembre 2026 à 9:00, après les bilans prêts (#64)', () => {
    const { code, journal } = jouer(true, true, true, true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const position = (debut: string) => lignes.findIndex((l) => l.startsWith(debut));
    const bilans = position('maestro test e2e/heure/bilans-prets.yaml');
    const mois = position('maestro test e2e/heure/bilan-mois.yaml');
    const automatique = position('adb shell settings put global auto_time 1');
    expect(bilans).toBeGreaterThanOrEqual(0);
    expect([bilans, mois, automatique]).toEqual([bilans, mois, automatique].sort((a, b) => a - b));
    expect(lignes[mois - 2]).toBe('adb shell pm clear app.kakeibo');
    expect(lignes[mois - 1]).toBe('adb shell date 110409002026.00');
  });

  it('récapitulatif : appli effacée, mercredi 4 novembre 2026 à 9:00, après le bilan du mois (#63)', () => {
    const { code, journal } = jouer(true, true, true, true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const position = (debut: string) => lignes.findIndex((l) => l.startsWith(debut));
    const mois = position('maestro test e2e/heure/bilan-mois.yaml');
    const recap = position('maestro test e2e/heure/recapitulatif.yaml');
    const automatique = position('adb shell settings put global auto_time 1');
    expect(mois).toBeGreaterThanOrEqual(0);
    expect([mois, recap, automatique]).toEqual([mois, recap, automatique].sort((a, b) => a - b));
    expect(lignes[recap - 2]).toBe('adb shell pm clear app.kakeibo');
    expect(lignes[recap - 1]).toBe('adb shell date 110409002026.00');
  });

  it('bilan de la semaine : appli effacée, mercredi 4 novembre 2026 à 9:00, après le récapitulatif (#62)', () => {
    const { code, journal } = jouer(true, true, true, true);
    expect(code).toBe(0);
    const lignes = journal.split('\n');
    const position = (debut: string) => lignes.findIndex((l) => l.startsWith(debut));
    const recap = position('maestro test e2e/heure/recapitulatif.yaml');
    const semaine = position('maestro test e2e/heure/bilan-semaine.yaml');
    const automatique = position('adb shell settings put global auto_time 1');
    expect(recap).toBeGreaterThanOrEqual(0);
    expect([recap, semaine, automatique]).toEqual(
      [recap, semaine, automatique].sort((a, b) => a - b),
    );
    expect(lignes[semaine - 2]).toBe('adb shell pm clear app.kakeibo');
    expect(lignes[semaine - 1]).toBe('adb shell date 110409002026.00');
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

describe('parcours Maestro « bilans prêts » (J3.1, #61)', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'heure', 'bilans-prets.yaml'), 'utf8');
  const motif = (texte: string) => texte.replace(/\./g, '\\.');

  it('la semaine scellée ouvre son bilan, passe avant le jour à rattraper, le bandeau le rouvre et le récapitulatif suit', () => {
    dansLOrdre(parcours, [
      "- tapOn: '\\+1 semaine'",
      `visible: '${fr.bilanSemaine.temps(1)}'`,
      `- assertVisible: '${fr.bilan.titreSemaine}'`,
      '- takeScreenshot: captures/bilans-ecran-semaine',
      `- tapOn: '${fr.bilan.retourLibelle}'`,
      `- assertVisible: '${motif(fr.accueil.bandeauBilanSemaine)}'`,
      "- assertNotVisible: 'Tu peux encore rattraper.*'",
      '- takeScreenshot: captures/bilans-semaine-prete',
      `- tapOn: '${motif(fr.accueil.bandeauBilanSemaine)}'`,
      `- assertVisible: '${fr.bilan.titreSemaine}'`,
      `- tapOn: '${fr.bilan.retourLibelle}'`,
      "- tapOn: '\\+1 semaine'",
      `visible: '${fr.recapitulatif.titre}'`,
      `- tapOn: '${fr.bilan.retourLibelle}'`,
      `- assertVisible: '${motif(fr.accueil.bandeauBilanSemaines)}'`,
      '- takeScreenshot: captures/bilans-recapitulatif',
    ]);
  });
});

describe('parcours Maestro « bilan du mois » (J3.4, #64)', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'heure', 'bilan-mois.yaml'), 'utf8');
  const motif = (texte: string) => texte.replace(/\./g, '\\.').replace(/\u00a0/g, '.');
  const b = fr.bilanMois;

  it('calcule les textes attendus avec ceux de l’appli', () => {
    expect(fr.bilan.titreMois('2026-11')).toBe('Bilan de novembre');
    expect(b.ligne(b.q1, 60000)).toMatch(/^Ce que j’avais.: 600.€$/);
    expect(b.ligne(b.q2, 0)).toMatch(/^Ce que je voulais mettre de côté.: 0.€$/);
    expect(b.ligne(b.q3, 67500)).toMatch(/^Ce que j’ai dépensé.: 675.€$/);
    expect(b.ligne('Essentiel', 65000)).toMatch(/^Essentiel.: 650.€$/);
    expect(b.ligne('Culture', 2500)).toMatch(/^Culture.: 25.€$/);
    expect(b.ligne(b.epargne, -7500)).toMatch(/^Ce que j’ai vraiment épargné.: −75.€$/);
    expect(b.objectifManque).toMatch(/^Ton épargne n’a pas atteint ton objectif ce mois-ci\..*$/);
    expect(b.q4Libelle).toMatch(/^Comment puis-je faire mieux.*Texte libre.*$/);
    expect(b.compteur(17)).toBe('17/140');
    expect(b.enregistre('2026-11')).toBe('Bilan de novembre enregistré.');
    expect(fr.messages.nouvellePiece('2026-12', 'Ōmisoka, le réveillon')).toMatch(
      /^La pièce de décembre s’ouvre.: c’est le mois d’Ōmisoka, le réveillon\.$/,
    );
    expect(fr.accueil.depassement(57500)).toMatch(/^Tu as dépassé de 575.€ cette semaine$/);
    expect(fr.accueil.date('2026-12-04')).toMatch(/^vendredi.4.décembre$/);
    expect(fr.dev.plusUnMois).toBe('+1 mois');
  });

  it('note deux dépenses en novembre, avance d’un mois et ouvre E7', () => {
    dansLOrdre(parcours, [
      `- tapOn: 'Poser un budget de démonstration.*'`,
      "- inputText: '650'",
      `- tapOn: '${fr.depense.categorieLibelle('Essentiel')}'`,
      "- inputText: '25'",
      `- tapOn: '${fr.depense.categorieLibelle('Culture')}'`,
      "- tapOn: '\\+1 mois'",
      "- openLink: 'kakeibo://bilan-mois'",
      `visible: '${fr.bilan.titreMois('2026-11')}'`,
    ]);
  });

  it('chiffre les trois questions par catégorie, puis la résolution, la validation et le retour', () => {
    dansLOrdre(parcours, [
      "- assertVisible: 'Ce que j’avais.: 600.€'",
      "- assertVisible: 'Ce que j’ai dépensé.: 675.€'",
      "- assertVisible: 'Essentiel.: 650.€'",
      "- assertVisible: 'Culture.: 25.€'",
      "- assertVisible: 'Ce que j’ai vraiment épargné.: −75.€'",
      '- takeScreenshot: captures/bilan-mois-questions',
      "- inputText: 'Cuisiner le soir.'",
      "- assertVisible: '17/140'",
      '- takeScreenshot: captures/bilan-mois-resolution',
      `- tapOn: '${b.valider}'`,
      // Depuis J3.5, la confirmation du budget s'intercale avant la pièce qui s'ouvre.
      `'${motif(b.enregistre('2026-11'))}'`,
      '- takeScreenshot: captures/bilan-mois-valide',
      `- tapOn: '${fr.bilan.retourLibelle}'`,
      `- assertNotVisible: '${motif(fr.accueil.bandeauBilanMois('2026-11'))}'`,
    ]);
  });
});

describe('parcours Maestro « bilan du mois » : budget du nouveau mois et résolution (J3.5, #65)', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'heure', 'bilan-mois.yaml'), 'utf8');
  const motif = (texte: string) => texte.replace(/\./g, '\\.').replace(/\u00a0/g, '.');
  const b = fr.bilanMois;

  it('calcule les textes attendus avec ceux de l’appli', () => {
    expect(b.budgetTitre('2026-12')).toBe('Ton budget de décembre');
    expect(b.budgetDuMois(60000)).toMatch(/^Budget du mois.: 600.€$/);
    expect(b.budgetDuMois(75500)).toMatch(/^Budget du mois.: 755.€$/);
    expect(b.budgetDuMois(0)).toMatch(/^Budget du mois.: 0.€$/);
    expect(b.budgetNul).toMatch(/^Ton budget du mois doit être supérieur à 0.€\.$/);
    expect(b.champLibelle(b.revenus)).toBe('Revenus, en euros');
    expect(b.confirmerBudget).toBe('Confirmer mon budget');
    expect(fr.accueil.reste(13613, 'dimanche')).toMatch(/^Il te reste 136,13.€ jusqu’à dimanche$/);
    expect(fr.accueil.reste(17048, 'dimanche')).toMatch(/^Il te reste 170,48.€ jusqu’à dimanche$/);
    expect(fr.dev.bilansVus).toBe('Marquer les bilans de semaine vus');
    expect(fr.dev.bilansVusFait).toBe('Bilans de semaine marqués vus');
    expect(fr.accueil.bandeauRattraper('2026-11-30')).toMatch(
      /^Tu peux encore rattraper lundi.30.novembre\.$/,
    );
    expect(fr.accueil.bandeauRattraper('2026-12-01')).toMatch(
      /^Tu peux encore rattraper mardi.1er.décembre\.$/,
    );
    expect(fr.accueil.bandeauResolution('Cuisiner le soir.')).toMatch(
      /^Ta résolution du mois.: «.Cuisiner le soir\..»$/,
    );
  });

  it('confirme le budget de décembre changé, puis la pièce s’ouvre', () => {
    dansLOrdre(parcours, [
      `- tapOn: '${b.valider}'`,
      `visible: '${b.budgetTitre('2026-12')}'`,
      "- assertVisible: 'Budget du mois.: 600.€'",
      '- takeScreenshot: captures/bilan-mois-budget',
      "- tapOn: 'Revenus, en euros'",
      "- inputText: '600'",
      "- assertVisible: 'Budget du mois.: 0.€'",
      `- assertVisible: '${motif(b.budgetNul)}'`,
      '- takeScreenshot: captures/bilan-mois-budget-nul',
      "- inputText: '1355'",
      "- assertVisible: 'Budget du mois.: 755.€'",
      `- tapOn: '${b.confirmerBudget}'`,
      `visible: '${motif(fr.messages.nouvellePiece('2026-12', 'Ōmisoka, le réveillon'))}'`,
      '- takeScreenshot: captures/bilan-mois-valide',
    ]);
  });

  it('montre la résolution sur l’accueil, puis l’enveloppe qui suit le nouveau budget', () => {
    dansLOrdre(parcours, [
      `- tapOn: '${fr.bilan.retourLibelle}'`,
      "- assertVisible: 'Il te reste 136,13.€ jusqu’à dimanche'",
      `- tapOn: '${fr.dev.bilansVus}'`,
      "- tapOn: 'Tu peux encore rattraper lundi.30.novembre\\.'",
      "- tapOn: 'Tu peux encore rattraper jeudi.3.décembre\\.'",
      `- tapOn: '${fr.cloture.rienDepense}'`,
      "visible: 'Ta résolution du mois.: «.Cuisiner le soir\\..»'",
      '- takeScreenshot: captures/accueil-resolution',
      "- tapOn: '\\+1 semaine'",
      "visible: 'Il te reste 170,48.€ jusqu’à dimanche'",
      '- takeScreenshot: captures/accueil-budget-decembre',
    ]);
  });
});

describe('parcours Maestro « récapitulatif » (J3.3, #63)', () => {
  const parcours = readFileSync(
    join(__dirname, '..', 'e2e', 'heure', 'recapitulatif.yaml'),
    'utf8',
  );
  const r = fr.recapitulatif;
  /** Texte de l'appli en motif Maestro : points et parenthèses échappés, insécables en « . ». */
  const motif = (texte: string) => texte.replace(/[.()]/g, (c) => `\\${c}`).replace(/\u00a0/g, '.');

  it('150 € pour 100 €, seul mercredi clôturé, puis trois semaines plus tard', () => {
    expect(parcours).toMatch(/appId: app\.kakeibo/);
    dansLOrdre(parcours, [
      "- tapOn: 'Poser un budget de démonstration.*'",
      "- inputText: '150'",
      `- tapOn: '${fr.depense.categorieLibelle('Envies')}'`,
      `- tapOn: '${fr.accueil.cloturerJournee}'`,
      `- tapOn: '${fr.cloture.toutNote}'`,
      "- assertVisible: 'Décalage.: 7 jours'",
      "- assertVisible: 'Décalage.: 14 jours'",
      "- assertVisible: 'Décalage.: 21 jours'",
      "visible: 'mercredi.25.novembre'",
      `- assertVisible: '${motif(fr.accueil.bandeauBilanSemaines)}'`,
      '- takeScreenshot: captures/recapitulatif-bandeau',
    ]);
    expect(fr.accueil.depassement(5000)).toMatch(/^Tu as dépassé de 50.€ cette semaine$/);
  });

  it('un seul écran, une ligne par semaine de la plus ancienne à la plus récente', () => {
    const ligne = (morceaux: string[]) => `- assertVisible: '${motif(r.ligneLibelle(morceaux))}'`;
    dansLOrdre(parcours, [
      `- tapOn: '${motif(fr.accueil.bandeauBilanSemaines)}'`,
      `- assertVisible: '${r.titre}'`,
      ligne([
        r.semaine('2026-11-02'),
        r.tampons(1, 5),
        r.horsEnveloppe,
        r.poussiere,
        r.objetFele('échelle'),
      ]),
      ligne([r.semaine('2026-11-09'), r.tampons(0, 7), r.dansEnveloppe, r.poussiere]),
      ligne([r.semaine('2026-11-16'), r.tampons(0, 7), r.dansEnveloppe, r.poussiere]),
      '- takeScreenshot: captures/recapitulatif-semaines',
    ]);
  });

  it('puis la poussière, la file de réparation et la conclusion ; « Continuer » marque tout vu', () => {
    dansLOrdre(parcours, [
      '- takeScreenshot: captures/recapitulatif-semaines',
      `- assertVisible: '${r.maisonTitre}'`,
      `- assertVisible: '${motif(fr.messages.poussiereJours)}'`,
      `- assertVisible: '${motif(fr.messages.poussiereSemaineIncomplete)}'`,
      `- assertVisible: '${motif(r.reparationEnCours('échelle', 0))}'`,
      `- assertVisible: '${motif(r.conclusion)}'`,
      '- takeScreenshot: captures/recapitulatif-maison',
      `- tapOn: '${r.continuer}'`,
      `- assertNotVisible: '${motif(fr.accueil.bandeauBilanSemaines)}'`,
      `- assertVisible: '${motif(fr.accueil.bandeauRattraper('2026-11-23'))}'`,
      '- takeScreenshot: captures/recapitulatif-fin',
    ]);
  });

  it('efface les données à la fin', () => {
    expect(parcours.trimEnd()).toMatch(/- launchApp:\n {4}clearState: true$/);
  });
});

describe('parcours Maestro « bilan de la semaine » (J3.2, #62)', () => {
  const parcours = readFileSync(
    join(__dirname, '..', 'e2e', 'heure', 'bilan-semaine.yaml'),
    'utf8',
  );
  const b = fr.bilanSemaine;
  /** Texte de l'appli en motif Maestro : points échappés, insécables en « . ». */
  const motif = (texte: string) => texte.replace(/\./g, '\\.').replace(/\u00a0/g, '.');
  const rateau = { nom: 'râteau porte-bonheur kumade', article: 'le', genre: 'm' } as const;

  it('calcule les textes attendus avec ceux de l’appli', () => {
    expect(fr.accueil.reste(7000, 'dimanche')).toMatch(/^Il te reste 70.€ jusqu’à dimanche$/);
    expect(fr.accueil.depassement(1000)).toMatch(/^Tu as dépassé de 10.€ cette semaine$/);
    expect(b.depense(3000, 10000)).toMatch(/^Dépensé.: 30.€ sur 100.€$/);
    expect(b.depense(15000, 14000)).toMatch(/^Dépensé.: 150.€ sur 140.€$/);
    expect(b.suivantLibelle).toBe('Passer au temps suivant');
    expect(b.tirerLibelle).toMatch(/^Tirer la tirette.*$/);
    expect(b.terminerLibelle).toMatch(/^Terminer le bilan.*$/);
    expect(fr.recapitulatif.semaine('2026-11-02')).toMatch(/^Semaine du 2.novembre$/);
  });

  it('une semaine complète dans le budget : quatre temps, la tirette et la capsule', () => {
    expect(parcours).toMatch(/appId: app\.kakeibo/);
    expect(parcours.match(/^- tapOn: 'Rien dépensé aujourd’hui'$/gm)).toHaveLength(4);
    dansLOrdre(parcours, [
      "- tapOn: 'Poser un budget de démonstration.*'",
      "- inputText: '30'",
      `- tapOn: '${fr.cloture.toutNote}'`,
      "visible: 'dimanche.8.novembre'",
      `- tapOn: '${fr.cloture.rienDepense}'`,
      `visible: '${b.temps(1)}'`,
      `- assertVisible: '${b.tamponsSur(5, 5)}'`,
      '- takeScreenshot: captures/bilan-semaine-tampons',
      `- tapOn: '${b.suivantLibelle}'`,
      `- assertVisible: '${motif(b.depense(3000, 10000))}'`,
      `- assertVisible: '${fr.recapitulatif.dansEnveloppe}'`,
      '- takeScreenshot: captures/bilan-semaine-enveloppe',
      `- tapOn: '${b.suivantLibelle}'`,
      `- assertVisible: '${motif(fr.bilan.toutTamponsDansBudget)}'`,
      `- assertNotVisible: '${b.suivantLibelle}'`,
      '- takeScreenshot: captures/bilan-semaine-tirette',
      "- tapOn: 'Tirer la tirette.*'",
      `visible: '${motif(fr.messages.ouvertureCapsule(rateau))}'`,
      '- takeScreenshot: captures/bilan-semaine-capsule',
      `- tapOn: '${b.suivantLibelle}'`,
      `- assertVisible: '${b.nomObjet(rateau)}'`,
      `- assertVisible: '${motif(b.conclusionObjet)}'`,
      '- takeScreenshot: captures/bilan-semaine-objet',
      "- tapOn: 'Terminer le bilan.*'",
      `- assertNotVisible: '${motif(fr.accueil.bandeauBilanSemaine)}'`,
    ]);
  });

  it('puis une semaine sans tampon, hors budget : la poussière et la fêlure, sans tirette', () => {
    const apres = parcours.slice(
      parcours.indexOf('- takeScreenshot: captures/bilan-semaine-objet'),
    );
    dansLOrdre(apres, [
      "- inputText: '150'",
      "- tapOn: '\\+1 semaine'",
      "- tapOn: '\\+1 jour'",
      `visible: '${b.temps(1)}'`,
      `- assertVisible: '${b.tamponsSur(0, 7)}'`,
      `- assertVisible: '${motif(b.depense(15000, 14000))}'`,
      `- assertVisible: '${fr.recapitulatif.horsEnveloppe}'`,
      `- assertVisible: '${motif(fr.bilan.manqueHorsBudget(rateau))}'`,
      "- assertNotVisible: 'Tirer la tirette.*'",
      `- assertVisible: '${motif(fr.messages.fele(rateau))}'`,
      '- takeScreenshot: captures/bilan-semaine-felure',
      `- assertVisible: '${motif(b.conclusionSansObjet)}'`,
      "- tapOn: 'Terminer le bilan.*'",
    ]);
  });

  it('efface les données à la fin', () => {
    expect(parcours.trimEnd()).toMatch(/- launchApp:\n {4}clearState: true$/);
  });
});
