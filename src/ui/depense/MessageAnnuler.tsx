// Message après une dépense notée (E3) : « Annuler » reste visible 5 secondes.
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { fr } from '../../i18n/fr';
import { type CategorieId, theme } from '../theme';

export const DUREE_ANNULER_MS = 5000;

const c = theme.couleurs;

export interface PropsMessageAnnuler {
  montant: number;
  categorie: CategorieId;
  onAnnuler: () => void;
  /** Appelé au bout de 5 secondes. */
  onFin: () => void;
}

export function MessageAnnuler({ montant, categorie, onAnnuler, onFin }: PropsMessageAnnuler) {
  useEffect(() => {
    const minuteur = setTimeout(onFin, DUREE_ANNULER_MS);
    return () => clearTimeout(minuteur);
  }, [onFin]);

  return (
    <View
      testID="message-annuler"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 8,
        paddingLeft: 16,
        backgroundColor: c.principal,
      }}
    >
      <Text style={{ flex: 1, color: c.surPrincipal, paddingVertical: 12 }}>
        {fr.depense.notee(montant, fr.categories[categorie].nom)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fr.depense.annulerLibelle}
        onPress={onAnnuler}
        style={{
          minHeight: theme.zoneTactileMin,
          minWidth: theme.zoneTactileMin,
          paddingHorizontal: 16,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: c.surPrincipal, fontWeight: '700', textDecorationLine: 'underline' }}>
          {fr.depense.annuler}
        </Text>
      </Pressable>
    </View>
  );
}
