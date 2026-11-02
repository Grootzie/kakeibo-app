import { Text, View } from 'react-native';
import { fr } from '@/i18n/fr';

export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text accessibilityRole="header">{fr.app.name}</Text>
    </View>
  );
}
