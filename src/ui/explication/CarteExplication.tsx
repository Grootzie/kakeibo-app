// Carte de première fois (E12) : le moment en titre, le texte de la spec, fermée d'une touche.
// « En savoir plus » et l'écran Comprendre viennent en J5 (décision du propriétaire, #48).
// `CarteDuMoment` choisit la carte d'un écran et la montre.
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';

import { fr } from '../../i18n/fr';
import type { IdExplication, MomentsEcran } from '../../state/explications';
import type { KakeiboStore } from '../../state/store';
import { theme } from '../theme';
import { useCarteExplication } from './useCarteExplication';

const c = theme.couleurs;

/** Texte de chaque carte, tiré de « Messages d'explication ». */
export const TEXTES_EXPLICATION: Record<IdExplication, string> = {
  first_expense: fr.explications.premiereDepense,
  first_stamp: fr.explications.premierTampon,
  first_catch_up: fr.explications.premierJourARattraper,
  first_capsule: fr.explications.premiereCapsule,
  first_dust: fr.explications.premierePoussiere,
  first_crack: fr.explications.premiereFelure,
  first_repair: fr.explications.premiereReparation,
  first_month_review: fr.explications.premierBilanDuMois,
  new_room: fr.explications.nouvellePiece,
};

export interface PropsCarteExplication {
  id: IdExplication;
  onFermer: () => void;
  /** Texte qui suit celui de la spec : pour « Nouvelle pièce », l'explication de la pièce. */
  complement?: string;
}

export function CarteExplication({ id, onFermer, complement }: PropsCarteExplication) {
  const titre = fr.carteExplication.titres[id];
  const texte = complement ? `${TEXTES_EXPLICATION[id]} ${complement}` : TEXTES_EXPLICATION[id];

  // Le lecteur d'écran lit la carte dès qu'elle apparaît.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${titre}. ${texte}`);
  }, [titre, texte]);

  return (
    <View
      testID={`explication-${id}`}
      accessibilityLiveRegion="polite"
      style={{
        gap: 8,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.texteDiscret,
        backgroundColor: c.discret,
      }}
    >
      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', color: c.texte }}>
        {titre}
      </Text>
      <Text style={{ color: c.texte, lineHeight: 22 }}>{texte}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fr.carteExplication.fermerLibelle(titre)}
        onPress={onFermer}
        style={{
          alignSelf: 'flex-end',
          minHeight: theme.zoneTactileMin,
          minWidth: theme.zoneTactileMin,
          paddingHorizontal: 12,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: c.texte, fontWeight: '600' }}>{fr.carteExplication.fermer}</Text>
      </Pressable>
    </View>
  );
}

export interface PropsCarteDuMoment {
  store: KakeiboStore;
  /** Cartes que cet écran peut montrer, dans l'ordre où elles passent. */
  proposees: readonly IdExplication[];
  /** Moments que l'écran constate (cartes de J3). */
  moments?: MomentsEcran;
  /** Faux tant que l'écran n'est pas visible, ou pendant une animation : rien ne s'ouvre. */
  actif?: boolean;
  /** Texte qui suit celui de la spec, carte par carte. */
  complements?: Partial<Record<IdExplication, string>>;
}

/** La carte de première fois d'un écran, une à la fois : la suivante vient à la fermeture. */
export function CarteDuMoment({
  store,
  proposees,
  moments,
  actif = true,
  complements = {},
}: PropsCarteDuMoment) {
  const { carte, fermer } = useCarteExplication(store, proposees, actif, moments);
  if (carte === null) return null;
  return (
    <CarteExplication key={carte} id={carte} onFermer={fermer} complement={complements[carte]} />
  );
}
