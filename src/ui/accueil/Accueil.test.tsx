// Accueil sans maison (E2, #43) : en-tête, enveloppe, carte de tampons, boutons et bandeau.
import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';

import { fr } from '../../i18n/fr';
import type { CaseTampon, StatutCase, VueAccueil } from '../../state/selecteurs';
import { theme } from '../theme';
import { Accueil } from './Accueil';

const semaine = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
];

function vue(partiel: Partial<VueAccueil> = {}): VueAccueil {
  const statuts: StatutCase[] = [
    'hors_decompte',
    'cloturee',
    'rattrapable',
    'cloturee',
    'a_cloturer',
    'a_venir',
    'a_venir',
  ];
  const cases: CaseTampon[] = semaine.map((jour, i) => ({ jour, statut: statuts[i] }));
  return {
    jour: '2026-11-06',
    enveloppe: {
      semaine: '2026-W45',
      enveloppe: 14000,
      depense: 7700,
      reste: 6300,
      dansLeBudget: true,
    },
    cases,
    aujourdhuiCloture: false,
    bandeau: null,
    ...partiel,
  };
}

const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('en-tête', () => {
  it('donne la date du jour en français', async () => {
    await render(<Accueil vue={vue()} />);
    expect(screen.getByRole('header', { name: 'vendredi 6\u00a0novembre' })).toBeOnTheScreen();
  });

  it('montre le carnet et les réglages, inactifs tant que E9 et E10 n’existent pas', async () => {
    await render(<Accueil vue={vue()} />);
    expect(screen.getByRole('button', { name: fr.accueil.carnetLibelle })).toBeDisabled();
    expect(screen.getByRole('button', { name: fr.accueil.reglagesLibelle })).toBeDisabled();
  });
});

describe('enveloppe', () => {
  it('donne le reste jusqu’à dimanche, le budget de la semaine et une jauge', async () => {
    await render(<Accueil vue={vue()} />);
    expect(screen.getByText('Il te reste 63 € jusqu’à dimanche')).toBeOnTheScreen();
    expect(screen.getByText(fr.accueil.budgetSemaine(14000))).toBeOnTheScreen();
    const jauge = screen.getByRole('progressbar');
    expect(jauge.props.accessibilityLabel).toBe(fr.accueil.jaugeLibelle(7700, 14000));
    expect(jauge.props.accessibilityValue).toEqual({ min: 0, max: 14000, now: 7700 });
    expect(style('jauge-remplie').width).toBe('55%');
  });

  it('annonce le dépassement sans couleur d’alerte rouge', async () => {
    await render(
      <Accueil
        vue={vue({
          enveloppe: {
            semaine: '2026-W45',
            enveloppe: 14000,
            depense: 15200,
            reste: -1200,
            dansLeBudget: false,
          },
        })}
      />,
    );
    const message = screen.getByText('Tu as dépassé de 12 € cette semaine');
    expect(StyleSheet.flatten(message.props.style).color).toBe(theme.couleurs.texte);
    expect(screen.queryByText(/Il te reste/)).toBeNull();
    // La jauge est pleine, de la même couleur que dans le budget.
    expect(style('jauge-remplie')).toMatchObject({
      width: '100%',
      backgroundColor: theme.couleurs.jauge,
    });
  });

  it('montre un reste nul tant qu’aucun budget n’est posé', async () => {
    await render(
      <Accueil
        vue={vue({
          enveloppe: {
            semaine: '2026-W45',
            enveloppe: 0,
            depense: 0,
            reste: 0,
            dansLeBudget: true,
          },
        })}
      />,
    );
    expect(screen.getByText('Il te reste 0 € jusqu’à dimanche')).toBeOnTheScreen();
    expect(style('jauge-remplie').width).toBe('0%');
  });
});

describe('carte de tampons', () => {
  it('a 7 cases du lundi au dimanche, chacune annoncée au lecteur d’écran', async () => {
    await render(<Accueil vue={vue()} />);
    const libelles = semaine.map((j) => screen.getByTestId(`case-${j}`).props.accessibilityLabel);
    expect(libelles).toEqual([
      'lundi, hors décompte',
      'mardi, clôturé',
      'mercredi, à rattraper',
      'jeudi, clôturé',
      'vendredi, à clôturer aujourd’hui',
      'samedi, à venir',
      'dimanche, à venir',
    ]);
  });

  it('dessine les cinq états autrement que par la couleur : bord, remplissage ou lettre barrée', async () => {
    const tous: StatutCase[] = [
      'cloturee',
      'a_cloturer',
      'rattrapable',
      'hors_decompte',
      'a_venir',
    ];
    await render(
      <Accueil vue={vue({ cases: tous.map((s, i) => ({ jour: semaine[i], statut: s })) })} />,
    );
    const signature = (jour: string) => {
      const cadre = style(`case-${jour}`);
      const lettre = style(`case-lettre-${jour}`);
      const rempli = cadre.backgroundColor !== theme.couleurs.fond;
      return `${String(cadre.borderStyle)}/${String(cadre.borderWidth)}/${rempli}/${String(lettre.textDecorationLine)}`;
    };
    const signatures = tous.map((_, i) => signature(semaine[i]));
    expect(new Set(signatures).size).toBe(5);
  });

  it('garde des cases de 44 points au moins', async () => {
    await render(<Accueil vue={vue()} />);
    semaine.forEach((j) => {
      expect(style(`case-${j}`).minHeight).toBeGreaterThanOrEqual(theme.zoneTactileMin);
    });
  });
});

describe('boutons', () => {
  it('propose « Noter une dépense » en principal et « Clôturer ma journée »', async () => {
    await render(<Accueil vue={vue()} />);
    const noter = screen.getByRole('button', { name: fr.accueil.noterDepenseLibelle });
    const cloturer = screen.getByRole('button', { name: 'Clôturer ma journée' });
    expect(cloturer).toBeEnabled();
    expect(StyleSheet.flatten(noter.props.style).backgroundColor).toBe(theme.couleurs.principal);
    [noter, cloturer].forEach((b) =>
      expect(StyleSheet.flatten(b.props.style).minHeight).toBeGreaterThanOrEqual(44),
    );
  });

  it('affiche « Journée clôturée » une fois la journée clôturée', async () => {
    await render(<Accueil vue={vue({ aujourdhuiCloture: true })} />);
    expect(screen.getByRole('button', { name: 'Journée clôturée' })).toBeDisabled();
    expect(screen.queryByText('Clôturer ma journée')).toBeNull();
  });

  it('montre « Noter une dépense » même avant le chargement de l’état', async () => {
    await render(<Accueil vue={null} />);
    expect(screen.getByText('Noter une dépense')).toBeOnTheScreen();
  });
});

describe('bandeau', () => {
  it('signale le jour à rattraper', async () => {
    await render(
      <Accueil vue={vue({ bandeau: { type: 'jour_a_rattraper', jour: '2026-11-04' } })} />,
    );
    expect(
      screen.getByText('Tu peux encore rattraper mercredi 4\u00a0novembre.'),
    ).toBeOnTheScreen();
  });

  it('n’apparaît pas sans jour à rattraper', async () => {
    await render(<Accueil vue={vue()} />);
    expect(screen.queryByTestId('bandeau')).toBeNull();
  });
});

describe('texte agrandi', () => {
  it('ne tronque aucun texte et laisse défiler l’écran', async () => {
    await render(<Accueil vue={vue()} />);
    expect(screen.getByTestId('accueil').type).toBe('RCTScrollView');
    const source = readFileSync(join(__dirname, 'Accueil.tsx'), 'utf8');
    expect(source).not.toMatch(
      /numberOfLines|allowFontScaling|maxFontSizeMultiplier|adjustsFontSizeToFit/,
    );
  });
});
