import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fr } from '@/i18n/fr';
import { horloge } from '@/state/clock';
import { theme } from '@/ui/theme';

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Panneau caché : appui long sur le titre. Rien n'est affiché dans un build publié. */
export function HorlogeDev() {
  const [, rafraichir] = useState(0);
  if (!horloge.actif) return null;

  const agir = (action: () => void) => () => {
    action();
    rafraichir((n) => n + 1);
  };
  const jour = () => horloge.avancerJours(1);
  const semaine = () => horloge.avancerSemaines(1);
  const mois = () => horloge.avancerMois(1);
  const zero = () => horloge.reinitialiser();
  const boutons = [
    { titre: fr.dev.plusUnJour, action: jour },
    { titre: fr.dev.plusUneSemaine, action: semaine },
    { titre: fr.dev.plusUnMois, action: mois },
    { titre: fr.dev.reinitialiser, action: zero },
  ];

  return (
    <View testID="horloge-dev" style={{ marginTop: 16 }}>
      <Text accessibilityRole="header" style={{ color: theme.couleurs.texte }}>
        {fr.dev.horlogeTitre}
      </Text>
      <Text testID="horloge-etat" style={{ color: theme.couleurs.texteDiscret }}>
        {fr.dev.horlogeEtat(Math.round(horloge.decalageMs() / JOUR_MS))}
      </Text>
      {boutons.map(({ titre, action }) => (
        <Pressable
          key={titre}
          accessibilityRole="button"
          accessibilityLabel={titre}
          onPress={agir(action)}
          style={{ minHeight: theme.zoneTactileMin, justifyContent: 'center' }}
        >
          <Text style={{ color: theme.couleurs.texte }}>{titre}</Text>
        </Pressable>
      ))}
    </View>
  );
}
