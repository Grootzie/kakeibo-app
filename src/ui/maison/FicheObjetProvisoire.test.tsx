// Fiche d'objet provisoire (J4.6, #85) : toucher un objet ouvre sa fiche ; J4.7 (#86) la remplira.
import { fireEvent, render, screen } from '@testing-library/react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { createKakeiboStore } from '../../state/store';
import { FicheObjetProvisoire } from './FicheObjetProvisoire';

async function store() {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  return createKakeiboStore({
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge: createClock({ actif: true, reel: () => new Date(2026, 10, 2, 8, 0) }),
    nouvelId: () => 'id',
  });
}

describe('Fiche d’objet provisoire', () => {
  it('le nom de l’objet, accordé avec son article, et le retour à la maison', async () => {
    const onRetour = jest.fn();
    await render(
      <FicheObjetProvisoire store={await store()} itemId="echelle" onRetour={onRetour} />,
    );
    expect(screen.getByRole('header', { name: 'L’échelle' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: fr.ecranMaison.ficheRetourLibelle }));
    expect(onRetour).toHaveBeenCalledTimes(1);
  });

  it('objet inconnu : le titre de la maison', async () => {
    await render(
      <FicheObjetProvisoire store={await store()} itemId="inconnu" onRetour={jest.fn()} />,
    );
    expect(screen.getByRole('header', { name: fr.ecranMaison.titre })).toBeOnTheScreen();
  });
});
