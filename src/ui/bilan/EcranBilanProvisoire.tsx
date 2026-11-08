// Place des bilans de la semaine (E6) et du mois (E7), en attendant J3.2 et J3.4 : un titre et
// un retour à l'accueil. Rien n'y est marqué vu ni validé : le bandeau de l'accueil reste.
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fr } from '../../i18n/fr';
import { theme } from '../theme';

const c = theme.couleurs;

export interface PropsEcranBilanProvisoire {
  testID: string;
  titre: string;
  onRetour?: () => void;
}

export function EcranBilanProvisoire({ testID, titre, onRetour }: PropsEcranBilanProvisoire) {
  return (
    <SafeAreaView
      testID={testID}
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fr.bilan.retourLibelle}
          onPress={onRetour}
          style={{
            minHeight: theme.zoneTactileMin,
            minWidth: theme.zoneTactileMin,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.texte }}>{fr.bilan.retour}</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
        >
          {titre}
        </Text>
      </View>
    </SafeAreaView>
  );
}
