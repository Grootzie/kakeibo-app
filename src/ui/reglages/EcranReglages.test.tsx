// Réglages (E10, J5.6), avec le vrai store sur une base de test : budget du mois (revenus,
// épargne, dépenses récurrentes à ajouter, modifier, arrêter), rappel du soir et autorisation,
// tout effacer avec double confirmation, à propos et lien vers Comprendre, accessibilité.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Keyboard, StyleSheet } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { type Repositories, createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { formatEuros, fr } from '../../i18n/fr';
import { bienvenueAAfficher } from '../../state/bienvenue';
import { createClock } from '../../state/clock';
import type { ServiceRappels } from '../../state/rappel';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { theme } from '../theme';
import { EcranReglages } from './EcranReglages';

const r = fr.reglages;
const euros = (n: number): number => Math.round(n * 100);

function service(autorise: boolean): ServiceRappels {
  return {
    autorise: async () => autorise,
    demanderAutorisation: async () => autorise,
    remplacer: async () => undefined,
  };
}

/** Installation le mercredi 4 novembre 2026 à 9:00 ; budget 2 000 €, 1 100 €, 300 €. */
async function preparer(
  options: { autorise?: boolean } = {},
): Promise<{ store: KakeiboStore; repos: Repositories }> {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let n = 0;
  const store = createKakeiboStore({
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge: createClock({ actif: true, reel: () => new Date(2026, 10, 4, 9, 0) }),
    nouvelId: () => `id-${++n}`,
    rappels: service(options.autorise ?? true),
  });
  await store.getState().ouvrir();
  expect(
    await store.getState().poserBudgetInitial({
      income: euros(2000),
      fixedCosts: euros(1100),
      savingsGoal: euros(300),
    }),
  ).toBeNull();
  return { store, repos };
}

async function monter(store: KakeiboStore) {
  const props = {
    onRetour: jest.fn(),
    onComprendre: jest.fn(),
    onEfface: jest.fn(),
    onOuvrirReglagesTelephone: jest.fn(),
  };
  await render(<EcranReglages store={store} {...props} />);
  // L'autorisation des notifications se lit à l'ouverture.
  await act(async () => undefined);
  return props;
}

const bouton = (nom: string) => screen.getByRole('button', { name: nom });
const champ = (nom: string) => screen.getByLabelText(nom);
/** Les textes affichés, dans l'ordre de l'écran. */
function textes(): string[] {
  const vus: string[] = [];
  type Noeud = ReturnType<typeof screen.toJSON> | string;
  const parcourir = (n: Noeud): void => {
    if (n === null || typeof n === 'string') return;
    if (Array.isArray(n)) return n.forEach(parcourir);
    if (n.type === 'Text') vus.push((n.children ?? []).join(''));
    (n.children ?? []).forEach((e) => parcourir(e));
  };
  parcourir(screen.toJSON());
  return vus;
}

// Le premier rendu charge les modules de l'écran (plus de 5 s à froid en intégration continue) :
// on le fait une fois ici, pour que la limite de 5 s de chaque test ne mesure que le test.
beforeAll(async () => {
  const { store } = await preparer();
  await monter(store);
}, 30_000);

describe('Réglages (E10)', () => {
  it('un titre, quatre sections, ni abonnement ni publicité avant J7', async () => {
    const { store } = await preparer();
    const { onRetour } = await monter(store);
    expect(screen.getByRole('header', { name: r.titre })).toBeTruthy();
    for (const titre of [r.budget.titre, r.rappel.titre, r.donnees.titre, r.aPropos.titre]) {
      expect(screen.getByRole('header', { name: titre })).toBeTruthy();
    }
    // Ni section ni bouton Abonnement ou Publicité : seuls les quatre titres de section.
    const titres = screen.getAllByRole('header').map((h) => h.props.children);
    expect(titres).toEqual([
      r.titre,
      r.budget.titre,
      r.charges.titre,
      r.rappel.titre,
      r.donnees.titre,
      r.aPropos.titre,
    ]);
    for (const b of screen.getAllByRole('button')) {
      expect(b.props.accessibilityLabel).not.toMatch(/abonnement|publicit|achat/i);
    }
    expect(screen.queryByText(/^Abonnement$|^Publicité$/)).toBeNull();
    await fireEvent.press(bouton(r.retourLibelle));
    expect(onRetour).toHaveBeenCalledTimes(1);
  });
});

describe('budget du mois', () => {
  it('pré-remplit revenus et épargne, liste les dépenses récurrentes et dit quand ça s’applique', async () => {
    const { store } = await preparer();
    await monter(store);
    expect(champ(r.budget.champLibelle(r.budget.revenus)).props.value).toBe('2000');
    expect(champ(r.budget.champLibelle(r.budget.epargne)).props.value).toBe('300');
    expect(screen.getByText(r.budget.chargesFixes(euros(1100)))).toBeTruthy();
    expect(screen.getByText(r.budget.budgetMois(euros(600)))).toBeTruthy();
    const ligne = bouton(
      r.charges.ligneLibelle(fr.budget.chargesFixes, euros(1100), 'Chaque mois, le 1er'),
    );
    expect(ligne.props.accessibilityHint).toBe(r.charges.ligneIndice);
    expect(r.budget.quand('2026-11-09')).toBe(
      'Un changement s’applique à ton enveloppe à partir du lundi 9 novembre. La semaine en cours ne change pas.',
    );
    expect(screen.getByText(r.budget.quand('2026-11-09'))).toBeTruthy();
  });

  it('change les revenus et l’épargne : une nouvelle version, et l’écran dit quand elle s’applique', async () => {
    const { store, repos } = await preparer();
    await monter(store);
    const enregistrer = bouton(r.budget.enregistrer);
    expect(enregistrer).toBeDisabled();
    await fireEvent.changeText(champ(r.budget.champLibelle(r.budget.revenus)), '2100');
    await fireEvent.changeText(champ(r.budget.champLibelle(r.budget.epargne)), '200');
    expect(screen.getByText(r.budget.budgetMois(euros(800)))).toBeTruthy();
    expect(enregistrer).toBeEnabled();
    await fireEvent.press(enregistrer);
    expect(screen.getByText(r.budget.enregistre('2026-11-09'))).toBeTruthy();
    expect(r.budget.enregistre('2026-11-09')).toBe(
      'C’est noté. Ton enveloppe changera le lundi 9 novembre.',
    );
    const versions = await repos.budgetVersions.all();
    expect(versions[versions.length - 1]).toMatchObject({
      income: euros(2100),
      savings_goal: euros(200),
      fixed_costs: euros(1100),
      effective_from: '2026-11-05',
    });
  });

  it('enregistrer ferme le clavier et dit « C’est noté » juste sous le bouton, visible aussitôt', async () => {
    const { store } = await preparer();
    await monter(store);
    const fermer = jest.spyOn(Keyboard, 'dismiss');
    await fireEvent.changeText(champ(r.budget.champLibelle(r.budget.revenus)), '2100');
    await fireEvent.press(bouton(r.budget.enregistrer));
    expect(fermer).toHaveBeenCalled();
    fermer.mockRestore();
    const ordre = textes();
    const message = ordre.indexOf(r.budget.enregistre('2026-11-09'));
    expect(message).toBeGreaterThan(ordre.indexOf(r.budget.enregistrer));
    expect(message).toBeLessThan(ordre.indexOf(r.charges.titre));
  });

  it('une dépense récurrente enregistrée ferme le clavier ; « C’est noté » reste sous la liste', async () => {
    const { store } = await preparer();
    await monter(store);
    await fireEvent.press(bouton(r.charges.ajouter));
    await fireEvent.changeText(champ(r.charges.libelle), 'Abonnement');
    await fireEvent.changeText(champ(r.budget.champLibelle(r.charges.montant)), '12');
    const fermer = jest.spyOn(Keyboard, 'dismiss');
    await fireEvent.press(bouton(r.charges.enregistrerLibelle));
    expect(fermer).toHaveBeenCalled();
    fermer.mockRestore();
    const ordre = textes();
    expect(ordre.indexOf(r.budget.enregistre('2026-11-09'))).toBeGreaterThan(
      ordre.indexOf(r.charges.ajouter),
    );
    expect(ordre.filter((t) => t === r.budget.enregistre('2026-11-09'))).toHaveLength(1);
  });

  it('un budget nul ne s’enregistre pas, et l’écran le dit', async () => {
    const { store, repos } = await preparer();
    await monter(store);
    await fireEvent.changeText(champ(r.budget.champLibelle(r.budget.revenus)), '1400');
    expect(screen.getByText(r.budget.budgetPositif)).toBeTruthy();
    expect(bouton(r.budget.enregistrer)).toBeDisabled();
    expect(await repos.budgetVersions.all()).toHaveLength(1);
  });

  it('ajoute une dépense récurrente : elle rejoint la liste et les charges fixes', async () => {
    const { store, repos } = await preparer();
    await monter(store);
    await fireEvent.press(bouton(r.charges.ajouter));
    expect(screen.getByRole('header', { name: r.charges.nouvelle })).toBeTruthy();
    expect(bouton(r.charges.enregistrerLibelle)).toBeDisabled();
    await fireEvent.changeText(champ(r.charges.libelle), 'Abonnement');
    await fireEvent.changeText(champ(r.budget.champLibelle(r.charges.montant)), '12');
    // Chaque mois, le 1er par défaut ; quatorze fois « jour suivant » : le 15.
    for (let i = 0; i < 14; i++) await fireEvent.press(bouton(r.charges.jourSuivant));
    expect(screen.getByLabelText(r.charges.jourLibelle('Chaque mois, le 15'))).toBeTruthy();
    await fireEvent.press(bouton(r.charges.enregistrerLibelle));
    expect(
      bouton(r.charges.ligneLibelle('Abonnement', euros(12), 'Chaque mois, le 15')),
    ).toBeTruthy();
    expect(screen.getByText(r.budget.chargesFixes(euros(1112)))).toBeTruthy();
    expect(screen.getByText(r.budget.enregistre('2026-11-09'))).toBeTruthy();
    expect(await repos.recurringCharges.all()).toContainEqual({
      id: expect.any(String),
      label: 'Abonnement',
      amount: euros(12),
      frequency: 'monthly',
      day: 15,
      starts_on: '2026-11-04',
      ends_on: null,
    });
  });

  it('une charge hebdomadaire se règle du lundi au dimanche', async () => {
    const { store, repos } = await preparer();
    await monter(store);
    await fireEvent.press(bouton(r.charges.ajouter));
    await fireEvent.changeText(champ(r.charges.libelle), 'Panier de légumes');
    await fireEvent.changeText(champ(r.budget.champLibelle(r.charges.montant)), '15');
    await fireEvent.press(screen.getByRole('radio', { name: r.charges.hebdomadaire }));
    await fireEvent.press(bouton(r.charges.jourPrecedent));
    expect(
      screen.getByLabelText(r.charges.jourLibelle('Chaque semaine, le dimanche')),
    ).toBeTruthy();
    await fireEvent.press(bouton(r.charges.enregistrerLibelle));
    const charges = await repos.recurringCharges.all();
    expect(charges[charges.length - 1]).toMatchObject({ frequency: 'weekly', day: 7 });
  });

  it('le 31 : l’écran prévient que les mois plus courts, l’échéance tombe le dernier jour', async () => {
    const { store } = await preparer();
    await monter(store);
    await fireEvent.press(bouton(r.charges.ajouter));
    expect(screen.queryByText(r.charges.finDeMois)).toBeNull();
    await fireEvent.press(bouton(r.charges.jourPrecedent));
    expect(screen.getByLabelText(r.charges.jourLibelle('Chaque mois, le 31'))).toBeTruthy();
    expect(screen.getByText(r.charges.finDeMois)).toBeTruthy();
  });

  it('modifie une dépense récurrente depuis sa fiche, pré-remplie', async () => {
    const { store, repos } = await preparer();
    await monter(store);
    await fireEvent.press(
      bouton(r.charges.ligneLibelle(fr.budget.chargesFixes, euros(1100), 'Chaque mois, le 1er')),
    );
    expect(screen.getByRole('header', { name: r.charges.modifier })).toBeTruthy();
    expect(champ(r.charges.libelle).props.value).toBe(fr.budget.chargesFixes);
    expect(champ(r.budget.champLibelle(r.charges.montant)).props.value).toBe('1100');
    await fireEvent.changeText(champ(r.charges.libelle), 'Loyer');
    await fireEvent.changeText(champ(r.budget.champLibelle(r.charges.montant)), '1000');
    await fireEvent.press(bouton(r.charges.enregistrerLibelle));
    expect(
      bouton(r.charges.ligneLibelle('Loyer', euros(1000), 'Chaque mois, le 1er')),
    ).toBeTruthy();
    expect(screen.getByText(r.budget.chargesFixes(euros(1000)))).toBeTruthy();
    const [charge] = await repos.recurringCharges.all();
    expect(charge).toMatchObject({ label: 'Loyer', amount: euros(1000), ends_on: null });
  });

  it('arrête une dépense récurrente : elle quitte la liste et garde son historique', async () => {
    const { store, repos } = await preparer();
    await monter(store);
    await fireEvent.press(bouton(r.charges.ajouter));
    await fireEvent.changeText(champ(r.charges.libelle), 'Abonnement');
    await fireEvent.changeText(champ(r.budget.champLibelle(r.charges.montant)), '12');
    await fireEvent.press(bouton(r.charges.enregistrerLibelle));
    const ligne = r.charges.ligneLibelle('Abonnement', euros(12), 'Chaque mois, le 1er');
    await fireEvent.press(bouton(ligne));
    expect(screen.getByText(r.charges.arreterAide)).toBeTruthy();
    await fireEvent.press(bouton(r.charges.arreterLibelle('Abonnement')));
    expect(screen.queryByRole('button', { name: ligne })).toBeNull();
    expect(screen.getByText(r.budget.chargesFixes(euros(1100)))).toBeTruthy();
    const arretee = (await repos.recurringCharges.all()).find((c) => c.label === 'Abonnement');
    expect(arretee?.ends_on).toBe('2026-11-04');
  });

  it('annuler la fiche ne change rien', async () => {
    const { store, repos } = await preparer();
    await monter(store);
    await fireEvent.press(bouton(r.charges.ajouter));
    await fireEvent.changeText(champ(r.charges.libelle), 'Abonnement');
    await fireEvent.press(bouton(r.charges.annulerLibelle));
    expect(screen.queryByRole('header', { name: r.charges.nouvelle })).toBeNull();
    expect(await repos.recurringCharges.all()).toHaveLength(1);
  });
});

describe('rappel du soir', () => {
  it('règle l’heure et l’active ou non, enregistrés aussitôt', async () => {
    const { store, repos } = await preparer();
    await monter(store);
    const interrupteur = screen.getByRole('switch', { name: r.rappel.activeLibelle });
    expect(interrupteur.props.value).toBe(true);
    await fireEvent.press(bouton(fr.bienvenue.rappel.plusTardLibelle(15)));
    expect(screen.getByLabelText(fr.bienvenue.rappel.heureLibelle('21:15'))).toBeTruthy();
    expect(await repos.settings.get()).toMatchObject({
      reminder_time: '21:15',
      reminder_enabled: 1,
    });
    await fireEvent(interrupteur, 'valueChange', false);
    expect(store.getState().reglagesRappel).toEqual({
      reminderTime: '21:15',
      reminderEnabled: false,
    });
    expect(await repos.settings.get()).toMatchObject({ reminder_enabled: 0 });
  });

  it('notifications refusées : l’écran explique comment les activer', async () => {
    const { store } = await preparer({ autorise: false });
    const { onOuvrirReglagesTelephone } = await monter(store);
    expect(screen.getByText(r.rappel.refuse)).toBeTruthy();
    await fireEvent.press(bouton(r.rappel.ouvrirReglages));
    expect(onOuvrirReglagesTelephone).toHaveBeenCalledTimes(1);
  });

  it('notifications accordées : pas d’explication', async () => {
    const { store } = await preparer({ autorise: true });
    await monter(store);
    expect(screen.queryByText(r.rappel.refuse)).toBeNull();
  });
});

describe('données : tout effacer', () => {
  it('demande deux confirmations, puis efface tout et ramène à la bienvenue', async () => {
    const { store, repos } = await preparer();
    await store
      .getState()
      .noterDepense({ day: '2026-11-04', amount: euros(12), category: 'envies', note: '' });
    const { onEfface } = await monter(store);
    await fireEvent.press(bouton(r.donnees.effacerLibelle));
    expect(screen.getByText(r.donnees.confirmation1)).toBeTruthy();
    expect(await repos.expenses.all()).toHaveLength(1);
    await fireEvent.press(bouton(r.donnees.continuerLibelle));
    expect(screen.getByText(r.donnees.confirmation2)).toBeTruthy();
    expect(await repos.expenses.all()).toHaveLength(1);
    await fireEvent.press(bouton(r.donnees.confirmerLibelle));
    expect(onEfface).toHaveBeenCalledTimes(1);
    expect(await repos.expenses.all()).toEqual([]);
    expect(await repos.budgetVersions.all()).toEqual([]);
    expect(bienvenueAAfficher(store.getState())).toBe(true);
  });

  it('annuler à l’une ou l’autre confirmation n’efface rien', async () => {
    const { store, repos } = await preparer();
    const { onEfface } = await monter(store);
    await fireEvent.press(bouton(r.donnees.effacerLibelle));
    await fireEvent.press(bouton(r.donnees.annulerLibelle));
    expect(screen.queryByText(r.donnees.confirmation1)).toBeNull();
    await fireEvent.press(bouton(r.donnees.effacerLibelle));
    await fireEvent.press(bouton(r.donnees.continuerLibelle));
    await fireEvent.press(bouton(r.donnees.annulerLibelle));
    expect(screen.queryByText(r.donnees.confirmation2)).toBeNull();
    expect(onEfface).not.toHaveBeenCalled();
    expect(await repos.budgetVersions.all()).toHaveLength(1);
  });
});

describe('à propos', () => {
  it('la méthode, la confidentialité, les mentions, et le lien vers Comprendre', async () => {
    const { store } = await preparer();
    const { onComprendre } = await monter(store);
    expect(screen.getByText(r.aPropos.methode)).toBeTruthy();
    expect(screen.getByText(r.aPropos.confidentialite)).toBeTruthy();
    expect(r.aPropos.mentions).toBe(
      'Kakeibo est un outil de suivi personnel. Il ne donne pas de conseil financier.',
    );
    expect(screen.getByText(r.aPropos.mentions)).toBeTruthy();
    await fireEvent.press(bouton(r.aPropos.comprendreLibelle));
    expect(onComprendre).toHaveBeenCalledTimes(1);
  });
});

describe('accessibilité', () => {
  it('chaque bouton offre une zone tactile de 44 points au moins', async () => {
    const { store } = await preparer();
    await monter(store);
    await fireEvent.press(bouton(r.charges.ajouter));
    await fireEvent.press(bouton(r.donnees.effacerLibelle));
    for (const b of screen.getAllByRole('button')) {
      const style = StyleSheet.flatten(b.props.style);
      expect({ nom: b.props.accessibilityLabel, h: style.minHeight }).toEqual({
        nom: b.props.accessibilityLabel,
        h: expect.any(Number),
      });
      expect(style.minHeight).toBeGreaterThanOrEqual(theme.zoneTactileMin);
    }
  });

  it('lisible à 200 % : l’écran défile, aucun texte n’est coupé', async () => {
    const { store } = await preparer();
    await monter(store);
    expect(screen.getByTestId('ecran-reglages-defilement')).toBeTruthy();
    const source = readFileSync(join(__dirname, 'EcranReglages.tsx'), 'utf8');
    expect(source).not.toMatch(/numberOfLines/);
    expect(source).not.toMatch(/allowFontScaling=\{false\}/);
  });

  it('les montants au format français', () => {
    expect(r.budget.budgetMois(euros(600))).toBe(`Budget du mois : ${formatEuros(60000)}`);
    expect(r.charges.echeance('weekly', 1)).toBe('Chaque semaine, le lundi');
    expect(r.charges.echeance('weekly', 7)).toBe('Chaque semaine, le dimanche');
    expect(r.charges.echeance('monthly', 1)).toBe('Chaque mois, le 1er');
  });
});
