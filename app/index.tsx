import { Text, View } from 'react-native';
import { fr } from '@/i18n/fr';
import { theme } from '@/ui/theme';

export default function Home() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.couleurs.fond,
      }}
    >
      <Text accessibilityRole="header" style={{ color: theme.couleurs.texte }}>
        {fr.app.name}
      </Text>
    </View>
  );
}
