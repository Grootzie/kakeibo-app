// Heure du rappel du soir par quarts d'heure (E1, E10) : deux boutons, et un curseur pour le
// lecteur d'écran (balayer vers le haut ou vers le bas).
import { type AccessibilityActionEvent, Pressable, Text, View } from 'react-native';

import { fr } from '../i18n/fr';
import { PAS_RAPPEL_MINUTES, decalerHeure } from '../state/bienvenue';
import { theme } from './theme';

const c = theme.couleurs;
const b = fr.bienvenue;
const ESPACE = 16;
const ACTIONS_HEURE = [{ name: 'increment' }, { name: 'decrement' }];

const styleBouton = {
  minHeight: theme.zoneTactileMin,
  borderRadius: 8,
  paddingHorizontal: ESPACE,
  paddingVertical: 12,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

/** Heure du rappel par quarts d'heure : deux boutons, et un curseur pour le lecteur d'écran. */
export function ReglageHeure({
  heure,
  onChange,
}: {
  heure: string;
  onChange: (h: string) => void;
}) {
  const pas = PAS_RAPPEL_MINUTES;
  const action = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') onChange(decalerHeure(heure, pas));
    if (e.nativeEvent.actionName === 'decrement') onChange(decalerHeure(heure, -pas));
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ESPACE,
        flexWrap: 'wrap',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={b.rappel.plusTotLibelle(pas)}
        onPress={() => onChange(decalerHeure(heure, -pas))}
        style={{ ...styleBouton, borderWidth: 1, borderColor: c.texte }}
      >
        <Text style={{ color: c.texte }}>{b.rappel.plusTot}</Text>
      </Pressable>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={b.rappel.heureLibelle(heure)}
        accessibilityHint={b.rappel.heureIndice}
        accessibilityActions={ACTIONS_HEURE}
        onAccessibilityAction={action}
      >
        <Text style={{ color: c.texte, fontSize: 36, fontWeight: '600' }}>{heure}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={b.rappel.plusTardLibelle(pas)}
        onPress={() => onChange(decalerHeure(heure, pas))}
        style={{ ...styleBouton, borderWidth: 1, borderColor: c.texte }}
      >
        <Text style={{ color: c.texte }}>{b.rappel.plusTard}</Text>
      </Pressable>
    </View>
  );
}
