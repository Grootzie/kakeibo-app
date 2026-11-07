import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fr } from '@/i18n/fr';
import { kakeibo } from '@/state/appStore';
import { horloge } from '@/state/clock';
import { theme } from '@/ui/theme';

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Panneau caché : appui long sur le titre. Rien n'est affiché dans un build publié. */
export function HorlogeDev() {
  const [, rafraichir] = useState(0);
  const [budgetDemo, setBudgetDemo] = useState<boolean | null>(null);
  const [rappel, setRappel] = useState<boolean | null>(null);
  if (!horloge.actif) return null;

  // Après chaque saut de l'horloge, l'appli traite l'heure nouvelle comme une ouverture.
  const agir = (action: () => void) => () => {
    action();
    rafraichir((n) => n + 1);
    void kakeibo.getState().ouvrir();
  };
  const poserBudgetDemo = async () => setBudgetDemo(await kakeibo.getState().poserBudgetDemo());
  // En attendant E1 (J5) : la demande d'autorisation du rappel du soir.
  const autoriserRappel = async () =>
    setRappel(await kakeibo.getState().demanderAutorisationRappel());
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
      <Pressable
        testID="budget-demo"
        accessibilityRole="button"
        accessibilityLabel={fr.dev.budgetDemoLibelle}
        onPress={() => void poserBudgetDemo()}
        style={{ minHeight: theme.zoneTactileMin, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.couleurs.texte }}>{fr.dev.budgetDemo}</Text>
      </Pressable>
      {budgetDemo !== null && (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.couleurs.texteDiscret }}>
          {budgetDemo ? fr.dev.budgetDemoPose : fr.dev.budgetDemoDejaLa}
        </Text>
      )}
      <Pressable
        testID="autoriser-rappel"
        accessibilityRole="button"
        accessibilityLabel={fr.dev.autoriserRappelLibelle}
        onPress={() => void autoriserRappel()}
        style={{ minHeight: theme.zoneTactileMin, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.couleurs.texte }}>{fr.dev.autoriserRappel}</Text>
      </Pressable>
      {rappel !== null && (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.couleurs.texteDiscret }}>
          {rappel ? fr.dev.rappelAutorise : fr.dev.rappelRefuse}
        </Text>
      )}
    </View>
  );
}
