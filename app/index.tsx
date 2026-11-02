import { useState } from 'react';
import { Text, View } from 'react-native';
import { fr } from '@/i18n/fr';
import { HorlogeDev } from '@/ui/HorlogeDev';
import { theme } from '@/ui/theme';

export default function Home() {
  const [horlogeVisible, setHorlogeVisible] = useState(false);
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.couleurs.fond,
      }}
    >
      <Text
        accessibilityRole="header"
        onLongPress={() => setHorlogeVisible((v) => !v)}
        style={{ color: theme.couleurs.texte }}
      >
        {fr.app.name}
      </Text>
      {horlogeVisible && <HorlogeDev />}
    </View>
  );
}
