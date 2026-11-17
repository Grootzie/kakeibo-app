// Bienvenue (E1, #101) avec le vrai store, une base de test et un service de notifications
// simulé : les quatre étapes, le budget du mois et l'enveloppe affichés, la suite bloquée tant
// que le budget n'est pas positif, l'heure du rappel (21:00 par défaut), puis l'accueil.
import { fireEvent, render, screen } from '@testing-library/react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import type { ServiceRappels } from '../../state/rappel';
import { createKakeiboStore } from '../../state/store';
import { EcranBienvenue } from './EcranBienvenue';

const b = fr.bienvenue;

/** Installation le mercredi 4 novembre 2026 à 9:00 : 5 jours décomptés dans la semaine. */
async function monter(options: { accorde?: boolean; horlogeActive?: boolean } = {}) {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let autorise = false;
  let demandes = 0;
  const rappels: ServiceRappels = {
    autorise: async () => autorise,
    demanderAutorisation: async () => {
      demandes += 1;
      autorise = options.accorde ?? true;
      return autorise;
    },
    remplacer: async () => undefined,
  };
  let n = 0;
  const store = createKakeiboStore({
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge: createClock({
      actif: options.horlogeActive ?? true,
      reel: () => new Date(2026, 10, 4, 9, 0),
    }),
    nouvelId: () => `id-${++n}`,
    rappels,
  });
  await store.getState().ouvrir();
  const onArrivee = jest.fn();
  await render(<EcranBienvenue store={store} onArrivee={onArrivee} />);
  return { store, repos, onArrivee, demandes: () => demandes };
}

const continuer = () => fireEvent.press(screen.getByRole('button', { name: b.continuerLibelle }));

async function remplirMois(revenus: string, charges: string, epargne: string) {
  await fireEvent.changeText(screen.getByLabelText(b.mois.champLibelle(b.mois.revenus)), revenus);
  await fireEvent.changeText(
    screen.getByLabelText(b.mois.champLibelle(b.mois.chargesFixes)),
    charges,
  );
  await fireEvent.changeText(screen.getByLabelText(b.mois.champLibelle(b.mois.epargne)), epargne);
}

async function allerAuMois() {
  await continuer();
  await continuer();
}

describe('Bienvenue (E1)', () => {
  test('étape 1 : la méthode en une minute, avec la maison en illustration', async () => {
    await monter();
    expect(screen.getByText(b.etape(1, 4))).toBeTruthy();
    expect(screen.getByRole('header', { name: b.methode.titre })).toBeTruthy();
    expect(screen.getByText(fr.explications.bienvenueMethode)).toBeTruthy();
    for (const geste of b.methode.gestes) {
      expect(screen.getByText(geste.titre)).toBeTruthy();
      expect(screen.getByText(geste.texte)).toBeTruthy();
    }
    expect(screen.getByText(b.methode.maison)).toBeTruthy();
    // La pièce du mois et ses 3 objets de base, décrits au lecteur d'écran.
    const maison = screen.getByTestId('bienvenue-maison');
    expect(maison.props.accessibilityLabel).toMatch(/^Kura, la réserve, novembre 2026\./);
    expect(screen.queryByRole('button', { name: b.retourLibelle })).toBeNull();
  });

  test('étape 2 : les quatre catégories, deux exemples chacune', async () => {
    await monter();
    await continuer();
    expect(screen.getByText(b.etape(2, 4))).toBeTruthy();
    expect(screen.getByRole('header', { name: b.categories.titre })).toBeTruthy();
    expect(screen.getByText(fr.explications.bienvenueCategories)).toBeTruthy();
    for (const id of ['essentiel', 'envies', 'culture', 'imprevus'] as const) {
      const exemples = b.categories.exemples[id];
      expect(exemples.split(', ')).toHaveLength(2);
      expect(
        screen.getByLabelText(b.categories.ligneLibelle(fr.categories[id].nom, exemples)),
      ).toBeTruthy();
      expect(screen.getByTestId(`icone-${id}`, { includeHiddenElements: true })).toBeTruthy();
    }
  });

  test('étape 3 : budget du mois et enveloppe de la semaine affichés', async () => {
    await monter();
    await allerAuMois();
    expect(screen.getByRole('header', { name: b.mois.titre })).toBeTruthy();
    expect(screen.getByText(fr.explications.bienvenueMois)).toBeTruthy();
    await remplirMois('2000', '1100', '300');
    expect(screen.getByText(b.mois.budgetMois(60000))).toBeTruthy();
    // Installation un mercredi : 5 jours décomptés à 20 € (600 € sur 30 jours).
    expect(screen.getByText(b.mois.enveloppeSemaine(10000))).toBeTruthy();
    expect(b.mois.budgetMois(60000)).toBe('Budget du mois\u00a0: 600\u00a0€');
  });

  test('étape 3 : on ne continue que si le budget du mois est supérieur à zéro', async () => {
    await monter();
    await allerAuMois();
    const bouton = () => screen.getByRole('button', { name: b.continuerLibelle });
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText(b.mois.remplir)).toBeTruthy();

    await remplirMois('1000', '700', '300');
    expect(screen.getByText(b.mois.budgetMois(0))).toBeTruthy();
    expect(screen.getByText(b.mois.budgetPositif)).toBeTruthy();
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
    await continuer();
    expect(screen.getByRole('header', { name: b.mois.titre })).toBeTruthy();

    await remplirMois('1000', '700', '299,99');
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: false });
    await continuer();
    expect(screen.getByRole('header', { name: b.rappel.titre })).toBeTruthy();
  });

  test('étape 3 : charges fixes et épargne vides comptent pour 0 €', async () => {
    await monter();
    await allerAuMois();
    await fireEvent.changeText(screen.getByLabelText(b.mois.champLibelle(b.mois.revenus)), '900');
    expect(screen.getByText(b.mois.budgetMois(90000))).toBeTruthy();
  });

  test('étape 4 : 21:00 par défaut, réglable, puis autorisation et arrivée sur l’accueil', async () => {
    const { repos, onArrivee, demandes } = await monter();
    await allerAuMois();
    await remplirMois('2000', '1100', '300');
    await continuer();
    expect(screen.getByText(b.etape(4, 4))).toBeTruthy();
    expect(screen.getByText(b.rappel.texte)).toBeTruthy();
    expect(screen.getByText(b.rappel.autorisation)).toBeTruthy();
    const heure = screen.getByLabelText(b.rappel.heureLibelle('21:00'));
    expect(heure).toBeTruthy();
    expect(screen.getByText('21:00')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: b.rappel.plusTardLibelle(15) }));
    expect(screen.getByText('21:15')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: b.rappel.plusTotLibelle(15) }));
    await fireEvent.press(screen.getByRole('button', { name: b.rappel.plusTotLibelle(15) }));
    expect(screen.getByText('20:45')).toBeTruthy();
    // Au lecteur d'écran, l'heure est un curseur.
    await fireEvent(screen.getByLabelText(b.rappel.heureLibelle('20:45')), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(screen.getByText('21:00')).toBeTruthy();

    expect(onArrivee).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: b.commencerLibelle }));
    expect(demandes()).toBe(1);
    expect(onArrivee).toHaveBeenCalledTimes(1);
    expect(await repos.budgetVersions.all()).toHaveLength(1);
    expect(await repos.recurringCharges.all()).toHaveLength(1);
    expect((await repos.settings.get())?.reminder_time).toBe('21:00');
  });

  test('un refus des notifications n’empêche pas d’arriver sur l’accueil', async () => {
    const { repos, onArrivee, demandes } = await monter({ accorde: false });
    await allerAuMois();
    await remplirMois('2000', '1100', '300');
    await continuer();
    await fireEvent.press(screen.getByRole('button', { name: b.commencerLibelle }));
    expect(demandes()).toBe(1);
    expect(onArrivee).toHaveBeenCalledTimes(1);
    expect(await repos.budgetVersions.all()).toHaveLength(1);
  });

  test('« Retour » revient à l’étape précédente sans perdre les montants', async () => {
    await monter();
    await allerAuMois();
    await remplirMois('2000', '1100', '300');
    await continuer();
    await fireEvent.press(screen.getByRole('button', { name: b.retourLibelle }));
    expect(screen.getByRole('header', { name: b.mois.titre })).toBeTruthy();
    expect(screen.getByText(b.mois.budgetMois(60000))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: b.retourLibelle }));
    expect(screen.getByRole('header', { name: b.categories.titre })).toBeTruthy();
  });

  test('builds de développement : « Passer la bienvenue » mène à l’accueil sans budget', async () => {
    const { store, repos, onArrivee } = await monter();
    await fireEvent.press(screen.getByRole('button', { name: b.passer }));
    expect(onArrivee).toHaveBeenCalledTimes(1);
    expect(store.getState().bienvenuePassee).toBe(true);
    expect(await repos.budgetVersions.all()).toEqual([]);
  });

  test('sans l’horloge de test, pas de « Passer la bienvenue »', async () => {
    await monter({ horlogeActive: false });
    expect(screen.queryByRole('button', { name: b.passer })).toBeNull();
  });
});
