// Accueil (E2, #43) : en-tête, enveloppe, carte de tampons, boutons et bandeau ; la maison (#84).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';

import { fr } from '../../i18n/fr';
import type { VueMaisonAccueil } from '../../state/maison';
import type { CaseTampon, StatutCase, VueAccueil } from '../../state/selecteurs';
import { sceneNovembre } from '../maison/scenesDeTest';
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

  it('ouvre le réglage caché par un appui long sur une zone pressable de la date (#49)', async () => {
    // Sur Android, l'appui long d'un simple Text dans le ScrollView ne se déclenchait pas
    // (parcours Maestro de #49) : la date est posée dans un Pressable, cible de l'appui long.
    const appuiLong = jest.fn();
    await render(<Accueil vue={vue()} onAppuiLongDate={appuiLong} />);
    const zone = screen.getByTestId('date-accueil');
    expect(zone.props.accessible).toBe(false);
    fireEvent(zone, 'longPress');
    expect(appuiLong).toHaveBeenCalledTimes(1);
    // La date reste un titre pour le lecteur d'écran.
    expect(screen.getByRole('header', { name: 'vendredi 6 novembre' })).toBeOnTheScreen();
  });

  it('reste hors de la barre d’état et de la barre de navigation, comme E4', async () => {
    // Sur Android, l'appli est dessinée bord à bord : sans zone sûre, la date passait sous la
    // barre d'état et l'appui long arrivait au système (parcours Maestro de #49).
    await render(<Accueil vue={vue()} />);
    const zone = screen.getByTestId('accueil-zone-sure');
    expect(zone.props.edges).toMatchObject({ top: 'additive', bottom: 'additive' });
    expect(StyleSheet.flatten(zone.props.style)).toMatchObject({
      flex: 1,
      backgroundColor: theme.couleurs.fond,
    });
    expect(zone).toContainElement(screen.getByTestId('date-accueil'));
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

describe('bandeau des bilans (J3.1, #61)', () => {
  it('le bilan de la semaine prêt est un bouton annoncé qui ouvre E6', async () => {
    const onBilanSemaine = jest.fn();
    await render(
      <Accueil
        vue={vue({ bandeau: { type: 'bilan_semaine', ecran: { kind: 'week', week: '2026-W45' } } })}
        onBilanSemaine={onBilanSemaine}
      />,
    );
    const bandeau = screen.getByRole('button', { name: 'Le bilan de ta semaine est prêt.' });
    expect(StyleSheet.flatten(bandeau.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(bandeau);
    expect(onBilanSemaine).toHaveBeenCalledTimes(1);
  });

  it('plusieurs semaines prêtes : un seul bandeau pour le récapitulatif', async () => {
    await render(
      <Accueil
        vue={vue({
          bandeau: {
            type: 'bilan_semaine',
            ecran: { kind: 'recap', weeks: ['2026-W45', '2026-W46'] },
          },
        })}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Le bilan de tes dernières semaines est prêt.' }),
    ).toBeOnTheScreen();
    expect(screen.getAllByTestId('bandeau')).toHaveLength(1);
  });

  it('le bilan du mois prêt est un bouton qui ouvre E7', async () => {
    const onBilanMois = jest.fn();
    await render(
      <Accueil
        vue={vue({ bandeau: { type: 'bilan_mois', mois: '2026-11' } })}
        onBilanMois={onBilanMois}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Le bilan de novembre est prêt.' }));
    expect(onBilanMois).toHaveBeenCalledTimes(1);
  });

  it('la résolution du mois s’affiche dans le bandeau, lue d’un seul tenant, sans être un bouton', async () => {
    await render(
      <Accueil
        vue={vue({
          bandeau: { type: 'resolution', mois: '2026-12', resolution: 'Cuisiner le soir.' },
        })}
      />,
    );
    const texte = 'Ta résolution du mois\u00a0: «\u00a0Cuisiner le soir.\u00a0»';
    expect(screen.getAllByTestId('bandeau')).toHaveLength(1);
    expect(screen.getByTestId('bandeau').props.accessibilityLabel).toBe(texte);
    expect(screen.getByText(texte)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: texte })).toBeNull();
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

describe('rattraper un jour (E5, #46)', () => {
  it('une case « à rattraper » est un bouton qui ouvre E5 pour son jour', async () => {
    const onRattraper = jest.fn();
    await render(<Accueil vue={vue()} onRattraper={onRattraper} />);
    const mercredi = screen.getByRole('button', { name: 'mercredi, à rattraper' });
    expect(StyleSheet.flatten(mercredi.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(mercredi);
    expect(onRattraper).toHaveBeenCalledWith('2026-11-04');
  });

  it('les autres cases ne s’ouvrent pas', async () => {
    await render(<Accueil vue={vue()} onRattraper={jest.fn()} />);
    for (const nom of [
      'lundi, hors décompte',
      'mardi, clôturé',
      'vendredi, à clôturer aujourd’hui',
      'samedi, à venir',
    ])
      expect(screen.queryByRole('button', { name: nom })).toBeNull();
  });

  it('le bandeau « jour à rattraper » est un bouton qui ouvre E5 pour son jour', async () => {
    const onRattraper = jest.fn();
    await render(
      <Accueil
        vue={vue({ bandeau: { type: 'jour_a_rattraper', jour: '2026-11-04' } })}
        onRattraper={onRattraper}
      />,
    );
    const bandeau = screen.getByRole('button', {
      name: 'Tu peux encore rattraper mercredi 4\u00a0novembre.',
    });
    expect(StyleSheet.flatten(bandeau.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(bandeau);
    expect(onRattraper).toHaveBeenCalledWith('2026-11-04');
  });
});

describe('la maison sur l’accueil (J4.5, #84)', () => {
  const piece = (room: string, month: string, items = sceneNovembre().items) => ({
    scene: sceneNovembre({ room, month, items }),
    description: `Description de ${room}.`,
  });
  const maison = (over: Partial<VueMaisonAccueil> = {}): VueMaisonAccueil => ({
    pieces: [piece('room-11', '2026-11'), piece('room-12', '2026-12', [])],
    courante: 1,
    poussiere: { joursSansCloture: false, semaineIncomplete: false },
    ...over,
  });
  /** Donne sa largeur à la maison, comme le ferait la mise en page. */
  async function poser(largeur = 328) {
    await fireEvent(screen.getByTestId('maison-accueil'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: largeur, height: (largeur * 3) / 4 } },
    });
  }
  /** Les pages dessinées ne sont pas lues au lecteur d'écran : on les cherche quand même. */
  const cache = (testID: string) => screen.getByTestId(testID, { includeHiddenElements: true });
  const glisser = (x: number) =>
    fireEvent(cache('maison-defilement'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x, y: 0 } },
    });

  it('montre la pièce du mois en cours, lue au lecteur d’écran avec sa place parmi les pièces', async () => {
    await render(<Accueil vue={vue()} maison={maison()} />);
    await poser();
    const m = screen.getByTestId('maison-accueil');
    expect(m).toHaveAccessibleName('Description de room-12.');
    expect(m.props.accessibilityRole).toBe('adjustable');
    expect(m.props.accessibilityValue).toEqual({ text: fr.accueil.maisonPosition(2, 2) });
    expect(m.props.accessibilityHint).toBe(fr.accueil.maisonIndice);
  });

  it('se place sous les boutons : bandeau, enveloppe, tampons et boutons restent en place', async () => {
    await render(
      <Accueil
        vue={vue({ bandeau: { type: 'jour_a_rattraper', jour: '2026-11-04' } })}
        maison={maison()}
      />,
    );
    // Ordre dans l'arbre rendu : bandeau, enveloppe (jauge), tampons, boutons, puis la maison.
    const arbre = JSON.stringify(screen.toJSON());
    const places = [
      'bandeau',
      'jauge-remplie',
      'case-2026-11-02',
      'bouton-noter',
      'maison-accueil',
    ].map((id) => arbre.indexOf(`"testID":"${id}"`));
    expect(places.every((p) => p >= 0)).toBe(true);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
    expect(screen.getByRole('button', { name: fr.accueil.noterDepenseLibelle })).toBeOnTheScreen();
  });

  it('un glissement passe d’une pièce débloquée à l’autre', async () => {
    await render(<Accueil vue={vue()} maison={maison()} />);
    await poser(328);
    await glisser(0);
    expect(screen.getByTestId('maison-accueil')).toHaveAccessibleName('Description de room-11.');
    expect(screen.getByTestId('maison-accueil').props.accessibilityValue).toEqual({
      text: fr.accueil.maisonPosition(1, 2),
    });
    await glisser(328);
    expect(screen.getByTestId('maison-accueil')).toHaveAccessibleName('Description de room-12.');
  });

  it('au lecteur d’écran, les gestes « augmenter » et « diminuer » changent de pièce', async () => {
    await render(<Accueil vue={vue()} maison={maison()} />);
    await poser();
    const m = () => screen.getByTestId('maison-accueil');
    expect(m().props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual([
      'increment',
      'decrement',
      'activate',
    ]);
    await fireEvent(m(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(m()).toHaveAccessibleName('Description de room-12.');
    await fireEvent(m(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(m()).toHaveAccessibleName('Description de room-11.');
    await fireEvent(m(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(m()).toHaveAccessibleName('Description de room-11.');
  });

  it('toucher la maison ouvre E8, du doigt comme au lecteur d’écran', async () => {
    const onMaison = jest.fn();
    await render(<Accueil vue={vue()} maison={maison()} onMaison={onMaison} />);
    await poser();
    await fireEvent.press(cache('piece-room-12'));
    expect(onMaison).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId('maison-accueil'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(onMaison).toHaveBeenCalledTimes(2);
  });

  it('dessine la pièce par le composant de rendu, sans annoncer la scène une seconde fois', async () => {
    await render(<Accueil vue={vue()} maison={maison()} />);
    await poser();
    expect(
      screen.getAllByTestId('maison', { includeHiddenElements: true }).length,
    ).toBeGreaterThanOrEqual(1);
    const pages = cache('maison-pages');
    expect(screen.queryByTestId('maison')).toBeNull();
    expect(pages.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(pages.props.accessibilityElementsHidden).toBe(true);
  });

  it('signale aux parcours de captures que la pièce affichée est entièrement dessinée', async () => {
    await render(
      <Accueil
        vue={vue()}
        maison={maison({ pieces: [piece('room-11', '2026-11')], courante: 0 })}
      />,
    );
    await poser();
    await act(async () => {
      await Promise.resolve();
    });
    const repere = screen.getByTestId('maison-dessinee');
    // Un simple repère pour Maestro : rien à lire ni à toucher pour le lecteur d'écran.
    expect(repere.props.accessible).not.toBe(true);
    expect(repere.props.accessibilityLabel).toBeUndefined();
    expect(repere).toBeEmptyElement();
    expect(repere.props.collapsable).toBe(false);
  });

  it('pas de repère « dessinée » tant que la maison n’a pas sa largeur', async () => {
    await render(<Accueil vue={vue()} maison={maison()} />);
    expect(screen.queryByTestId('maison-dessinee')).toBeNull();
  });

  it('une seule pièce : pas de repères de pièces', async () => {
    await render(
      <Accueil
        vue={vue()}
        maison={maison({ pieces: [piece('room-11', '2026-11')], courante: 0 })}
      />,
    );
    await poser();
    expect(screen.queryByTestId('maison-reperes')).toBeNull();
  });

  it('plusieurs pièces : un repère par pièce, plein pour la pièce affichée, sans couleur seule', async () => {
    await render(<Accueil vue={vue()} maison={maison()} />);
    await poser();
    expect(cache('maison-reperes')).toBeTruthy();
    // La pièce affichée (la 2e) : un repère plein ; l'autre, cerclé. La forme porte l'information.
    const fond = ['room-11', 'room-12'].map(
      (r) => StyleSheet.flatten(cache(`repere-${r}`).props.style).backgroundColor,
    );
    expect(fond[0]).toBe('transparent');
    expect(fond[1]).not.toBe('transparent');
  });

  it('la poussière s’explique sous la maison, sans reproche', async () => {
    await render(
      <Accueil
        vue={vue()}
        maison={maison({ poussiere: { joursSansCloture: true, semaineIncomplete: true } })}
      />,
    );
    expect(screen.getByText(fr.messages.poussiereJours)).toBeOnTheScreen();
    expect(screen.getByText(fr.messages.poussiereSemaineIncomplete)).toBeOnTheScreen();
  });

  it('maison propre : aucune phrase de poussière', async () => {
    await render(<Accueil vue={vue()} maison={maison()} />);
    expect(screen.queryByText(fr.messages.poussiereJours)).toBeNull();
    expect(screen.queryByText(fr.messages.poussiereSemaineIncomplete)).toBeNull();
  });

  it('texte agrandi : la maison ne contient aucun texte tronqué', async () => {
    const source = readFileSync(join(__dirname, 'MaisonAccueil.tsx'), 'utf8');
    expect(source).not.toMatch(
      /numberOfLines|allowFontScaling|maxFontSizeMultiplier|adjustsFontSizeToFit/,
    );
  });
});
