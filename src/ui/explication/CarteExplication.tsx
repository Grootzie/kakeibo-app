// Carte de première fois (E12) : le moment en titre, le texte de la spec, fermée d'une touche.
// « En savoir plus » et l'écran Comprendre viennent en J5 (décision du propriétaire, #48).
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';

import { fr } from '../../i18n/fr';
import type { IdExplication } from '../../state/explications';
import { theme } from '../theme';

const c = theme.couleurs;

/** Texte de chaque carte, tiré de « Messages d'explication ». */
export const TEXTES_EXPLICATION: Record<IdExplication, string> = {
  first_expense: fr.explications.premiereDepense,
  first_stamp: fr.explications.premierTampon,
  first_catch_up: fr.explications.premierJourARattraper,
};

export interface PropsCarteExplication {
  id: IdExplication;
  onFermer: () => void;
}

export function CarteExplication({ id, onFermer }: PropsCarteExplication) {
  const titre = fr.carteExplication.titres[id];
  const texte = TEXTES_EXPLICATION[id];

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
