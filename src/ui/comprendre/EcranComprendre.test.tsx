// Comprendre (E12, J5.7, #106), avec le vrai store sur une base de test : la liste des fiches,
// chaque fiche avec les textes de la spec, les fêtes des douze mois, les objets obtenus qui
// ouvrent leur fiche, l'ouverture directe à une fiche, les libellés d'accessibilité et la lecture
// à 200 %.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

import catalogueJson from '../../content/catalogue.json';
import { catalogue } from '../../content/catalogue';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { FICHES_COMPRENDRE, type FicheComprendre } from '../../state/comprendre';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { theme } from '../theme';
import { EcranComprendre } from './EcranComprendre';

const k = fr.comprendre;
const e = fr.explications;

/** Installation le mercredi 4 novembre 2026 à 9:00. */
async function preparer(): Promise<KakeiboStore> {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let n = 0;
  const store = createKakeiboStore({
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge: createClock({ actif: true, reel: () => new Date(2026, 10, 4, 9, 0) }),
    nouvelId: () => `id-${++n}`,
  });
  await store.getState().ouvrir();
  return store;
}

async function monter(store: KakeiboStore, fiche: FicheComprendre | null = null) {
  const onRetour = jest.fn();
  const onOuvrirObjet = jest.fn();
  await render(
    <EcranComprendre
      store={store}
      fiche={fiche}
      onRetour={onRetour}
      onOuvrirObjet={onOuvrirObjet}
    />,
  );
  return { onRetour, onOuvrirObjet };
}

const bouton = (nom: string) => screen.getByRole('button', { name: nom });

describe('Comprendre (E12)', () => {
  it('liste les huit fiches, chacune un bouton qui l’ouvre', async () => {
    const store = await preparer();
    const { onRetour } = await monter(store);
    expect(screen.getByRole('header', { name: k.titre })).toBeTruthy();
    for (const fiche of FICHES_COMPRENDRE) {
      const b = bouton(k.fiches[fiche]);
      expect(b.props.accessibilityHint).toBe(k.ficheIndice);
    }
    await fireEvent.press(bouton(k.retourLibelle));
    expect(onRetour).toHaveBeenCalledTimes(1);
  });

  it('la méthode : les textes de la spec, puis retour à toutes les fiches', async () => {
    const store = await preparer();
    await monter(store);
    await fireEvent.press(bouton(k.fiches.methode));
    expect(screen.getByRole('header', { name: k.fiches.methode })).toBeTruthy();
    expect(screen.getByText(e.bienvenueMethode)).toBeTruthy();
    expect(screen.getByText(e.premiereDepense)).toBeTruthy();
    expect(screen.getByText(e.bienvenueMois)).toBeTruthy();
    expect(screen.queryByText(e.premiereFelure)).toBeNull();
    await fireEvent.press(bouton(k.toutesLesFichesLibelle));
    expect(screen.getByRole('header', { name: k.titre })).toBeTruthy();
    expect(screen.queryByText(e.bienvenueMethode)).toBeNull();
  });

  it('les quatre catégories : icône et nom de chacune, jamais la couleur seule', async () => {
    const store = await preparer();
    await monter(store, 'categories');
    expect(screen.getByText(e.bienvenueCategories)).toBeTruthy();
    for (const id of ['essentiel', 'envies', 'culture', 'imprevus'] as const) {
      expect(screen.getByText(fr.categories[id].nom)).toBeTruthy();
      expect(screen.getByTestId(`icone-${id}`, { includeHiddenElements: true })).toBeTruthy();
    }
  });

  it('les quatre questions, la maison, le kintsugi et les gashapon reprennent leurs cartes', async () => {
    const store = await preparer();
    await monter(store, 'questions');
    expect(screen.getByText(e.premierBilanDuMois)).toBeTruthy();
    await fireEvent.press(bouton(k.toutesLesFichesLibelle));
    await fireEvent.press(bouton(k.fiches.maison));
    for (const t of [
      e.premierTampon,
      e.premierJourARattraper,
      e.premierePoussiere,
      e.nouvelleAnnee,
    ])
      expect(screen.getByText(t)).toBeTruthy();
    await fireEvent.press(bouton(k.toutesLesFichesLibelle));
    await fireEvent.press(bouton(k.fiches.kintsugi));
    expect(screen.getByText(e.premiereFelure)).toBeTruthy();
    expect(screen.getByText(e.premiereReparation)).toBeTruthy();
    await fireEvent.press(bouton(k.toutesLesFichesLibelle));
    await fireEvent.press(bouton(k.fiches.gashapon));
    expect(screen.getByText(e.premiereCapsule)).toBeTruthy();
  });

  it('les fêtes de chaque mois : les douze pièces du catalogue, avec leur fête et leur explication', async () => {
    const store = await preparer();
    await monter(store, 'fetes');
    expect(screen.getByText(e.nouvellePiece)).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Janvier · Genkan, l’entrée' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Novembre · Kura, la réserve' })).toBeTruthy();
    expect(screen.getByText('Tori no ichi et Shichi-go-san')).toBeTruthy();
    for (const room of catalogue.rooms) {
      expect(screen.getByText(room.explanation)).toBeTruthy();
    }
    expect(screen.getAllByRole('header')).toHaveLength(1 + 12);
  });

  it('tes objets : ceux de la maison de l’année, chacun ouvre sa fiche (J4.7)', async () => {
    const store = await preparer();
    const { onOuvrirObjet } = await monter(store, 'objets');
    expect(screen.getByRole('header', { name: 'Novembre · Kura, la réserve' })).toBeTruthy();
    const echelle = bouton('L’échelle');
    expect(echelle.props.accessibilityHint).toBe(k.objetIndice);
    expect(bouton('Les étagères')).toBeTruthy();
    expect(bouton('Le coffre nagamochi')).toBeTruthy();
    await fireEvent.press(echelle);
    expect(onOuvrirObjet).toHaveBeenCalledWith('echelle');
  });

  it('s’ouvre directement à la fiche demandée par « En savoir plus »', async () => {
    const store = await preparer();
    await monter(store, 'kintsugi');
    expect(screen.getByRole('header', { name: k.fiches.kintsugi })).toBeTruthy();
    expect(screen.getByText(e.premiereFelure)).toBeTruthy();
    expect(bouton(k.toutesLesFichesLibelle)).toBeTruthy();
    expect(bouton(k.retourLibelle)).toBeTruthy();
  });

  it('à 200 % : l’écran défile, aucun texte n’est tronqué ; zones tactiles de 44 points', async () => {
    const store = await preparer();
    await monter(store, 'objets');
    expect(screen.getByTestId('ecran-comprendre-defilement').type).toBe('RCTScrollView');
    for (const b of screen.getAllByRole('button'))
      expect(b.props.style).toMatchObject({ minHeight: theme.zoneTactileMin });
    await fireEvent.press(bouton(k.toutesLesFichesLibelle));
    for (const b of screen.getAllByRole('button'))
      expect(b.props.style).toMatchObject({ minHeight: theme.zoneTactileMin });
    expect(readFileSync(join(__dirname, 'EcranComprendre.tsx'), 'utf8')).not.toMatch(
      /numberOfLines|allowFontScaling|maxFontSizeMultiplier|adjustsFontSizeToFit/,
    );
  });
});

describe('textes de Comprendre', () => {
  it('nomme chaque fiche comme la liste de E12', () => {
    expect(k.fiches).toEqual({
      methode: 'La méthode kakeibo',
      categories: 'Les quatre catégories',
      questions: 'Les quatre questions',
      maison: 'Les règles de la maison',
      kintsugi: 'Le kintsugi',
      gashapon: 'Les gashapon',
      fetes: 'Les fêtes de chaque mois',
      objets: 'Tes objets',
    });
    expect(k.piece(11, 'Kura, la réserve')).toBe('Novembre · Kura, la réserve');
  });
});
