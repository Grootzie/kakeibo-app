// La maison sur l'accueil (E2, J4.5, #84) : la pièce du mois en cours avec sa poussière. Un
// glissement passe d'une pièce débloquée de l'année à l'autre ; toucher la maison ouvre E8.
// Chaque pièce est dessinée par le seul composant de rendu (J4.4).
//
// Au lecteur d'écran, la maison est un curseur : sa description, « Pièce 2 sur 3 », les gestes
// « augmenter » et « diminuer » pour changer de pièce, et l'activation pour ouvrir E8. Les pages
// dessinées ne sont pas lues une seconde fois.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from 'react-native';

import { catalogue } from '../../content/catalogue';
import { fr } from '../../i18n/fr';
import type { VueMaisonAccueil } from '../../state/maison';
import { Maison } from '../maison/Maison';
import { SCENE } from '../maison/emplacements';
import { useVisuelsDecodes } from '../maison/images';
import { visuelsDeScene } from '../maison/plan';
import { theme } from '../theme';

const c = theme.couleurs;
const ACTIONS = [{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }];
const REPERE = 8;

export interface PropsMaisonAccueil {
  maison: VueMaisonAccueil;
  /** Ouvre la maison (E8). */
  onOuvrir?: () => void;
}

/** Phrases de la poussière (Textes et ton), selon ses causes. */
function phrasesPoussiere({ poussiere }: VueMaisonAccueil): string[] {
  const phrases: string[] = [];
  if (poussiere.joursSansCloture) phrases.push(fr.messages.poussiereJours);
  if (poussiere.semaineIncomplete) phrases.push(fr.messages.poussiereSemaineIncomplete);
  return phrases;
}

export function MaisonAccueil({ maison, onOuvrir }: PropsMaisonAccueil) {
  const { pieces, courante } = maison;
  // La pièce choisie se garde par son identifiant : une pièce qui se débloque ne la déplace pas.
  const [choisie, setChoisie] = useState<string | null>(null);
  const trouvee = choisie === null ? -1 : pieces.findIndex((p) => p.scene.room === choisie);
  const index = trouvee >= 0 ? trouvee : Math.min(courante, pieces.length - 1);
  const vue = pieces[index];
  const [largeur, setLargeur] = useState(0);
  const defilement = useRef<ScrollViewInstance>(null);
  const visuels = useMemo(
    () => (vue === undefined ? [] : visuelsDeScene(vue.scene, catalogue)),
    [vue],
  );
  const decodes = useVisuelsDecodes(visuels);

  // La page affichée suit la pièce choisie (au montage, par le lecteur d'écran, ou au glissement).
  useEffect(() => {
    if (largeur > 0) defilement.current?.scrollTo({ x: index * largeur, animated: false });
  }, [index, largeur]);

  const aller = (i: number) => {
    const p = pieces[Math.max(0, Math.min(pieces.length - 1, i))];
    if (p !== undefined) setChoisie(p.scene.room);
  };
  const action = (e: AccessibilityActionEvent) => {
    switch (e.nativeEvent.actionName) {
      case 'increment':
        aller(index + 1);
        break;
      case 'decrement':
        aller(index - 1);
        break;
      case 'activate':
        onOuvrir?.();
        break;
    }
  };

  if (vue === undefined) return null;
  return (
    <View style={{ gap: 8 }}>
      <View
        testID="maison-accueil"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={vue.description}
        accessibilityValue={{ text: fr.accueil.maisonPosition(index + 1, pieces.length) }}
        accessibilityHint={fr.accueil.maisonIndice}
        accessibilityActions={ACTIONS}
        onAccessibilityAction={action}
        onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
        style={{
          width: '100%',
          aspectRatio: SCENE.largeur / SCENE.hauteur,
        }}
      >
        <View
          testID="maison-pages"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flex: 1 }}
        >
          {largeur > 0 && (
            <ScrollView
              testID="maison-defilement"
              ref={defilement}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: index * largeur, y: 0 }}
              onMomentumScrollEnd={(e) =>
                aller(Math.round(e.nativeEvent.contentOffset.x / largeur))
              }
            >
              {pieces.map((p, i) => (
                <Pressable
                  key={p.scene.room}
                  testID={`piece-${p.scene.room}`}
                  onPress={onOuvrir}
                  style={{ width: largeur }}
                >
                  {/* Seules la pièce affichée et ses voisines se dessinent. */}
                  {Math.abs(i - index) <= 1 ? (
                    <Maison vue={p} />
                  ) : (
                    <View style={{ width: '100%', aspectRatio: SCENE.largeur / SCENE.hauteur }} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
      {pieces.length > 1 && (
        // Repères des pièces : plein pour la pièce affichée, cerclé pour les autres.
        <View
          testID="maison-reperes"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}
        >
          {pieces.map((p, i) => (
            <View
              key={p.scene.room}
              testID={`repere-${p.scene.room}`}
              style={{
                width: REPERE,
                height: REPERE,
                borderRadius: REPERE / 2,
                borderWidth: 1.5,
                borderColor: c.texte,
                backgroundColor: i === index ? c.texte : 'transparent',
              }}
            />
          ))}
        </View>
      )}
      {largeur > 0 && decodes && (
        // Repère des parcours de captures (#88) : la pièce affichée a tous ses visuels décodés,
        // toile d'araignée comprise. Vide et sans libellé, le lecteur d'écran l'ignore.
        <View testID="maison-dessinee" collapsable={false} style={{ height: 1 }} />
      )}
      {phrasesPoussiere(maison).map((phrase) => (
        <Text key={phrase} style={{ color: c.texte }}>
          {phrase}
        </Text>
      ))}
    </View>
  );
}
