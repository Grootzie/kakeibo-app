// Feuille « Noter une dépense » (E3, #44) : montant, bornes, catégories, note, date.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { fr } from '../../i18n/fr';
import { theme } from '../theme';
import { FeuilleDepense, type PropsFeuilleDepense } from './FeuilleDepense';

const AUJOURDHUI = '2026-11-06';
const JOURS = ['2026-11-06', '2026-11-05', '2026-11-04'];

type Enregistrer = PropsFeuilleDepense['onEnregistrer'];

async function monter(enregistrer: Enregistrer = async () => true) {
  const onEnregistrer = jest.fn(enregistrer);
  const onFermer = jest.fn();
  await render(
    <FeuilleDepense
      jours={JOURS}
      aujourdhui={AUJOURDHUI}
      onEnregistrer={onEnregistrer}
      onFermer={onFermer}
    />,
  );
  return { onEnregistrer, onFermer };
}

const montant = () => screen.getByLabelText(fr.depense.montantLibelle);
const categorie = (nom: string) =>
  screen.getByRole('button', { name: fr.depense.categorieLibelle(nom) });
const noms = ['Essentiel', 'Envies', 'Culture', 'Imprévus'];

// Le premier rendu charge les modules de la Modal (3 à 5 s à froid en intégration continue) :
// on le fait une fois ici, pour que la limite de 5 s de chaque test ne mesure que le test.
beforeAll(async () => {
  await monter();
}, 30_000);

describe('ouverture', () => {
  it('monte du bas, le pavé numérique ouvert sur le montant', async () => {
    await monter();
    expect(screen.getByTestId('feuille-depense').props.animationType).toBe('slide');
    expect(montant().props.autoFocus).toBe(true);
    expect(montant().props.keyboardType).toBe('decimal-pad');
    expect(screen.getByRole('header', { name: fr.depense.titre })).toBeOnTheScreen();
  });

  it('laisse la place de la barre de navigation sous la feuille', async () => {
    await monter();
    expect(screen.getByTestId('feuille-depense-contenu').props.edges).toEqual({
      bottom: 'additive',
      left: 'off',
      right: 'off',
      top: 'off',
    });
  });

  it('propose quatre catégories, chacune avec sa couleur, son icône et son nom', async () => {
    await monter();
    const ids = ['essentiel', 'envies', 'culture', 'imprevus'] as const;
    ids.forEach((id, i) => {
      const bouton = categorie(noms[i]);
      expect(StyleSheet.flatten(bouton.props.style).backgroundColor).toBe(
        theme.categories[id].couleur,
      );
      expect(StyleSheet.flatten(bouton.props.style).minHeight).toBeGreaterThanOrEqual(44);
      // Décorative : masquée au lecteur d'écran, le nom suffit.
      expect(screen.getByTestId(`icone-${id}`, { includeHiddenElements: true })).not.toBeVisible();
      expect(screen.getByText(noms[i])).toBeOnTheScreen();
    });
  });

  it('se ferme sans rien enregistrer', async () => {
    const { onEnregistrer, onFermer } = await monter();
    await fireEvent.press(screen.getByRole('button', { name: fr.depense.fermerLibelle }));
    expect(onFermer).toHaveBeenCalledTimes(1);
    expect(onEnregistrer).not.toHaveBeenCalled();
  });
});

describe('bornes du montant', () => {
  it.each(['', '0', '0,00', '100000', '99999,991', 'abc'])(
    'garde les catégories inactives pour « %s »',
    async (texte) => {
      const { onEnregistrer } = await monter();
      await fireEvent.changeText(montant(), texte);
      noms.forEach((n) => expect(categorie(n)).toBeDisabled());
      await fireEvent.press(categorie('Envies'));
      expect(onEnregistrer).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['0,01', 1],
    ['12,5', 1250],
    ['99999,99', 9_999_999],
  ])('active les catégories pour « %s »', async (texte, centimes) => {
    const { onEnregistrer } = await monter();
    await fireEvent.changeText(montant(), texte);
    noms.forEach((n) => expect(categorie(n)).toBeEnabled());
    await fireEvent.press(categorie('Culture'));
    expect(onEnregistrer).toHaveBeenCalledWith({
      amount: centimes,
      category: 'culture',
      note: '',
      day: AUJOURDHUI,
    });
  });

  it('rappelle les bornes', async () => {
    await monter();
    expect(screen.getByText(fr.depense.bornes)).toBeOnTheScreen();
    expect(fr.depense.bornes).toBe('De 0,01 € à 99 999,99 €');
  });
});

describe('enregistrement', () => {
  it('toucher une catégorie enregistre la dépense et ferme la feuille', async () => {
    const { onEnregistrer, onFermer } = await monter();
    await fireEvent.changeText(montant(), '4,35');
    await fireEvent.press(categorie('Essentiel'));
    expect(onEnregistrer).toHaveBeenCalledWith({
      amount: 435,
      category: 'essentiel',
      note: '',
      day: AUJOURDHUI,
    });
    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it('reste ouverte et l’explique si la dépense est refusée', async () => {
    const { onFermer } = await monter(async () => false);
    await fireEvent.changeText(montant(), '5');
    await fireEvent.press(categorie('Imprévus'));
    expect(onFermer).not.toHaveBeenCalled();
    expect(screen.getByText(fr.depense.refus)).toBeOnTheScreen();
  });
});

describe('note', () => {
  it('est facultative et transmise avec la dépense', async () => {
    const { onEnregistrer } = await monter();
    await fireEvent.changeText(montant(), '8');
    await fireEvent.changeText(screen.getByLabelText(fr.depense.noteLibelle), 'cinéma');
    await fireEvent.press(categorie('Culture'));
    expect(onEnregistrer).toHaveBeenCalledWith(expect.objectContaining({ note: 'cinéma' }));
  });

  it('s’arrête à 80 caractères, avec un compteur', async () => {
    const { onEnregistrer } = await monter();
    const note = screen.getByLabelText(fr.depense.noteLibelle);
    await fireEvent.changeText(note, 'é'.repeat(90));
    expect(screen.getByLabelText(fr.depense.noteLibelle).props.value).toBe('é'.repeat(80));
    expect(screen.getByText('80/80')).toBeOnTheScreen();
    await fireEvent.changeText(montant(), '1');
    await fireEvent.press(categorie('Envies'));
    expect(onEnregistrer).toHaveBeenCalledWith(expect.objectContaining({ note: 'é'.repeat(80) }));
  });

  it('compte un caractère hors du plan de base pour un seul', async () => {
    await monter();
    await fireEvent.changeText(screen.getByLabelText(fr.depense.noteLibelle), '𝄞'.repeat(81));
    expect(Array.from(screen.getByLabelText(fr.depense.noteLibelle).props.value)).toHaveLength(80);
  });
});

describe('date', () => {
  it('propose seulement les jours reçus, aujourd’hui choisi par défaut', async () => {
    await monter();
    const choix = screen.getAllByRole('radio');
    expect(choix.map((c) => c.props.accessibilityLabel)).toEqual([
      'vendredi 6 novembre',
      'jeudi 5 novembre',
      'mercredi 4 novembre',
    ]);
    expect(screen.getByText(fr.depense.aujourdhui)).toBeOnTheScreen();
    expect(screen.getByText(fr.depense.hier)).toBeOnTheScreen();
    expect(screen.getByText('mer. 4')).toBeOnTheScreen();
    expect(choix[0]).toBeSelected();
    expect(choix[1]).not.toBeSelected();
  });

  it('change la date de la dépense', async () => {
    const { onEnregistrer } = await monter();
    await fireEvent.press(screen.getByRole('radio', { name: 'mercredi 4 novembre' }));
    expect(screen.getByRole('radio', { name: 'mercredi 4 novembre' })).toBeSelected();
    await fireEvent.changeText(montant(), '3');
    await fireEvent.press(categorie('Essentiel'));
    expect(onEnregistrer).toHaveBeenCalledWith(expect.objectContaining({ day: '2026-11-04' }));
  });

  it('garde des choix de date de 44 points au moins', async () => {
    await monter();
    screen.getAllByRole('radio').forEach((c) => {
      expect(StyleSheet.flatten(c.props.style).minHeight).toBeGreaterThanOrEqual(44);
    });
  });
});
