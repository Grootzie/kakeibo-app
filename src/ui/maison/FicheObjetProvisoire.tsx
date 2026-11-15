// Fiche d'objet (E8) : toucher un objet de la maison l'ouvre (J4.6, #85). Son contenu (l'objet en
// grand, ses noms, son explication et son histoire) arrive avec J4.7 (#86). D'ici là, le nom de
// l'objet et le retour à la maison.
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { fr } from '../../i18n/fr';
import type { KakeiboStore } from '../../state/store';
import { theme } from '../theme';

const c = theme.couleurs;
const m = fr.ecranMaison;

export interface PropsFicheObjetProvisoire {
  store: KakeiboStore;
  itemId: string | undefined;
  onRetour: () => void;
}

export function FicheObjetProvisoire({ store, itemId, onRetour }: PropsFicheObjetProvisoire) {
  const catalogue = useStore(store, (s) => s.catalogue);
  const item = catalogue.items.find((i) => {
    return i.id === itemId;
  });
  return (
    <SafeAreaView
      testID="fiche-objet"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={m.ficheRetourLibelle}
          onPress={onRetour}
          style={{
            minHeight: theme.zoneTactileMin,
            minWidth: theme.zoneTactileMin,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.texte }}>{m.retour}</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
        >
          {item === undefined
            ? m.titre
            : m.nomObjet({ nom: item.name, article: item.article, genre: item.gender })}
        </Text>
      </View>
    </SafeAreaView>
  );
}
