// La maison (E8, J4.6, #85), avec le vrai store sur une base de test et l'horloge de test :
// pièces débloquées, objets à leur place et leur état, « Réparation : x jours sur 7 » pour l'objet
// en tête de la file, objet fêlé qui attend son tour sans chiffre, emplacements libres, objet qui
// attend sa pièce, accès à la fiche et à l'album, libellés d'accessibilité.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { type Horloge, createClock } from '../../state/clock';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { theme } from '../theme';
import { EcranMaison } from './EcranMaison';

const NBSP = '\u00a0';
const m = fr.ecranMaison;

interface Preparation {
  store: KakeiboStore;
  horloge: Horloge;
}

const jourDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Installation le lundi 2 novembre 2026 à 8:00, budget de novembre (140 € par semaine). `jours` :
 * les journées à clôturer, chacune le soir ; `depenses` : les dépenses notées, à midi ; puis
 * retour à `fin`.
 */
async function preparer(
  jours: Date[],
  depenses: { jour: string; montant: number }[],
  fin: Date,
): Promise<Preparation> {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = new Date(2026, 10, 2, 8, 0);
  let n = 0;
  const horloge = createClock({ actif: true, reel: () => reel });
  const deps = {
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge,
    nouvelId: () => `id-${++n}`,
  };
  await createKakeiboStore(deps).getState().ouvrir();
  await repos.budgetVersions.add({
    id: 'b-nov',
    month: '2026-11',
    income: 200000,
    fixed_costs: 110000,
    savings_goal: 30000,
    effective_from: '2026-11-02',
  });
  const store = createKakeiboStore(deps);
  for (const j of jours) {
    const jour = jourDe(j);
    for (const d of depenses.filter((x) => x.jour === jour)) {
      reel = new Date(j.getFullYear(), j.getMonth(), j.getDate(), 12, 0);
      await store
        .getState()
        .noterDepense({ day: jour, amount: d.montant, category: 'envies', note: '' });
    }
    reel = new Date(j.getFullYear(), j.getMonth(), j.getDate(), 21, 0);
    await store.getState().cloturerJour(jour);
  }
  reel = fin;
  await store.getState().ouvrir();
  return { store, horloge };
}

const du = (debut: number, fin: number, sauf: number[] = []) =>
  Array.from({ length: fin - debut + 1 }, (_, i) => debut + i)
    .filter((j) => !sauf.includes(j))
    .map((j) => new Date(2026, 10, j));

/**
 * Semaine 45 hors budget, tous les jours clôturés : le kumade entre, l'échelle se fêle. Semaine
 * 46 hors budget, mercredi 11 oublié : le kumade se fêle à son tour. Lundi 16 novembre à 13:00,
 * l'échelle en est à 4 jours sur 7 (jeudi 12 à dimanche 15), le kumade attend son tour.
 */
const deuxFelures = () =>
  preparer(
    du(2, 15, [11]),
    [
      { jour: '2026-11-03', montant: 15000 },
      { jour: '2026-11-10', montant: 15000 },
    ],
    new Date(2026, 10, 16, 13, 0),
  );

async function monter(p: Preparation) {
  const props = { onRetour: jest.fn(), onOuvrirObjet: jest.fn(), onOuvrirAlbum: jest.fn() };
  await render(<EcranMaison store={p.store} {...props} />);
  return props;
}

describe('La maison (E8, #85)', () => {
  it('la pièce débloquée, ses objets à leur place et leur état, les emplacements libres', async () => {
    const p = await deuxFelures();
    await monter(p);
    expect(screen.getByRole('header', { name: m.titre })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Novembre · Kura, la réserve' })).toBeOnTheScreen();
    // La scène, dessinée par le seul composant de rendu, avec sa description.
    expect(
      screen.getByRole('image', {
        name:
          'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. ' +
          `L’échelle, fêlée, réparation${NBSP}: 4 jours sur 7. ` +
          'Le râteau porte-bonheur kumade, fêlé. 3 emplacements libres. Un voile de poussière.',
      }),
    ).toBeOnTheScreen();

    // Un bouton par objet, nommé par son nom et son état.
    const objets = screen.getAllByRole('button', { name: /^(Les|Le|L’)/ });
    expect(objets.map((o) => o.props.accessibilityLabel)).toEqual([
      'Les étagères, intactes',
      'Le coffre nagamochi, intact',
      `L’échelle, fêlée, réparation${NBSP}: 4 jours sur 7`,
      'Le râteau porte-bonheur kumade, fêlé, attend son tour de réparation',
    ]);
    for (const o of objets) expect(o.props.accessibilityHint).toBe(m.objetIndice);

    // « Réparation : 4 jours sur 7 » pour l'objet en tête de la file, et pour lui seul.
    expect(screen.getAllByText(/^Réparation\s:/)).toHaveLength(1);
    expect(screen.getByText(/^Réparation\s:\s4 jours sur 7$/)).toBeOnTheScreen();
    // Le kumade, fêlé, attend son tour : sans chiffre.
    expect(screen.getByText('Fêlé, attend son tour de réparation')).toBeOnTheScreen();
    expect(screen.getByText('Intactes')).toBeOnTheScreen();
    expect(screen.getByText('Intact')).toBeOnTheScreen();

    // Les emplacements libres, discrètement.
    expect(screen.getByText('3 emplacements libres pour les objets à gagner')).toBeOnTheScreen();
  });

  it('toucher un objet, dans la liste ou sur le dessin, ouvre sa fiche', async () => {
    const p = await deuxFelures();
    const props = await monter(p);
    await fireEvent.press(
      screen.getByRole('button', { name: `L’échelle, fêlée, réparation${NBSP}: 4 jours sur 7` }),
    );
    expect(props.onOuvrirObjet).toHaveBeenLastCalledWith('echelle');

    // Sur le dessin, une zone par objet, posée sur son emplacement ; le lecteur d'écran ne la lit
    // pas (la liste suffit).
    const maison = screen.getByTestId('maison');
    await act(async () => {
      maison.props.onLayout({ nativeEvent: { layout: { width: 360, height: 270 } } });
    });
    const zones = screen.getByTestId('zones-objets', { includeHiddenElements: true });
    expect(zones.props.importantForAccessibility).toBe('no-hide-descendants');
    await act(async () => {
      zones.props.onLayout({ nativeEvent: { layout: { width: 360, height: 270 } } });
    });
    const zone = screen.getByTestId('zone-rateau-porte-bonheur-kumade', {
      includeHiddenElements: true,
    });
    // Le kumade est sur le 1er emplacement des objets à gagner : ancrage (40, 262), cadre 64 × 64.
    expect(zone.props.style).toMatchObject({ left: 8, top: 198, width: 64, height: 64 });
    await fireEvent.press(zone);
    expect(props.onOuvrirObjet).toHaveBeenLastCalledWith('rateau-porte-bonheur-kumade');
    expect(screen.getAllByTestId(/^zone-/, { includeHiddenElements: true })).toHaveLength(4);
  });

  it('accès à l’album et retour à l’accueil', async () => {
    const p = await deuxFelures();
    const props = await monter(p);
    await fireEvent.press(screen.getByRole('button', { name: m.albumLibelle }));
    expect(props.onOuvrirAlbum).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: m.retourLibelle }));
    expect(props.onRetour).toHaveBeenCalledTimes(1);
  });

  it('objet réparé à l’or : plus de réparation affichée', async () => {
    const p = await preparer(
      du(2, 15),
      [{ jour: '2026-11-03', montant: 15000 }],
      new Date(2026, 10, 15, 21, 30),
    );
    await monter(p);
    expect(screen.getByRole('button', { name: 'L’échelle, réparée à l’or' })).toBeOnTheScreen();
    expect(screen.getByText('Réparée à l’or')).toBeOnTheScreen();
    expect(screen.queryByText(/Réparation\s:/)).toBeNull();
  });

  it('un objet gagné avant le déblocage de sa pièce l’attend, avec le message de la spec', async () => {
    const jours = [...du(2, 30), ...[1, 2, 3, 4, 5, 6].map((j) => new Date(2026, 11, j))];
    const p = await preparer(jours, [], new Date(2026, 11, 6, 21, 30));
    await monter(p);
    expect(screen.getAllByRole('header', { name: /·/ })).toHaveLength(1);
    expect(screen.getByRole('header', { name: m.enAttenteTitre })).toBeOnTheScreen();
    expect(screen.getByText('Le mortier et maillet à mochi')).toBeOnTheScreen();
    expect(
      screen.getByText(
        /^Ton objet attend la pièce de décembre\s:\selle s’ouvrira avec le bilan de novembre\.$/,
      ),
    ).toBeOnTheScreen();
    // Novembre est plein : aucun emplacement libre.
    expect(screen.queryByText(/emplacements? libres? pour/)).toBeNull();
  });

  it('zones tactiles de 44 points, aucun texte tronqué à 200 %', async () => {
    const p = await deuxFelures();
    await monter(p);
    for (const b of screen.getAllByRole('button'))
      expect(b.props.style).toMatchObject({ minHeight: theme.zoneTactileMin });
    // L'écran défile ; aucun texte n'est tronqué ni empêché de grandir.
    expect(screen.getByTestId('ecran-maison-defilement').type).toBe('RCTScrollView');
    for (const fichier of ['EcranMaison.tsx', 'ZonesObjets.tsx'])
      expect(readFileSync(join(__dirname, fichier), 'utf8')).not.toMatch(
        /numberOfLines|allowFontScaling|maxFontSizeMultiplier|adjustsFontSizeToFit/,
      );
  });
});
