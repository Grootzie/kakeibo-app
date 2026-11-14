// Machine à capsules du bilan de la semaine (E6, temps 3). Dessin provisoire, en attendant le lot
// de visuels (Fiche des visuels › Capsule gashapon) : la tirette tourne, la capsule tombe,
// s'ouvre en deux, l'objet en sort (1,5 s en tout). Avec « moins d'animations » (réglage du
// téléphone), la capsule est ouverte d'emblée, sans mouvement.
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { fr } from '../../i18n/fr';
import { theme } from '../theme';
import { ObjetProvisoire } from './ObjetProvisoire';
import type { ObjetNomme } from '../../state/selecteurs';

const c = theme.couleurs;
/** Durées de l'ouverture : tirette, chute, ouverture, sortie de l'objet (1,5 s en tout). */
export const DUREES_CAPSULE_MS = { tirette: 300, chute: 500, ouverture: 400, objet: 300 } as const;
/** Couleur provisoire de la capsule, en attendant celles de chaque mois. */
const CAPSULE = '#B4432D';

export interface PropsGashapon {
  objet: ObjetNomme;
  /** La tirette a été tirée : la capsule tombe et s'ouvre. */
  tiree: boolean;
  /** Pas de mouvement : capsule ouverte d'emblée. */
  reduit: boolean;
  /** La capsule est ouverte et l'objet sorti. */
  onOuverte: () => void;
}

export function Gashapon({ objet, tiree, reduit, onOuverte }: PropsGashapon) {
  // Déjà tirée à l'affichage (bilan rouvert) : la capsule est ouverte, sans rejouer l'animation.
  const [dejaOuverte] = useState(tiree);
  const depart = dejaOuverte || reduit ? 1 : 0;
  const [tirette] = useState(() => new Animated.Value(depart));
  const [chute] = useState(() => new Animated.Value(depart));
  const [ouverture] = useState(() => new Animated.Value(depart));
  const [sortie] = useState(() => new Animated.Value(depart));

  useEffect(() => {
    if (!tiree) return;
    if (dejaOuverte || reduit) {
      for (const v of [tirette, chute, ouverture, sortie]) v.setValue(1);
      onOuverte();
      return;
    }
    const etape = (v: Animated.Value, duration: number) =>
      Animated.timing(v, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
    const animation = Animated.sequence([
      etape(tirette, DUREES_CAPSULE_MS.tirette),
      etape(chute, DUREES_CAPSULE_MS.chute),
      etape(ouverture, DUREES_CAPSULE_MS.ouverture),
      etape(sortie, DUREES_CAPSULE_MS.objet),
    ]);
    animation.start(({ finished }) => {
      if (finished) onOuverte();
    });
    return () => animation.stop();
    // onOuverte change à chaque rendu du parent : seule la tirette relance l'animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiree, reduit]);

  const rotate = tirette.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const descente = chute.interpolate({ inputRange: [0, 1], outputRange: [-110, 0] });
  const haut = ouverture.interpolate({ inputRange: [0, 1], outputRange: [0, -34] });
  const bas = ouverture.interpolate({ inputRange: [0, 1], outputRange: [0, 34] });
  const echelle = sortie.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <View
      testID="gashapon"
      accessible
      accessibilityLabel={fr.bilanSemaine.machineLibelle}
      style={{ alignItems: 'center', gap: 12 }}
    >
      {/* La machine : un globe de capsules, la fente et la tirette. */}
      <View
        style={{
          width: 160,
          height: 150,
          borderRadius: 16,
          borderWidth: 3,
          borderColor: c.principal,
          backgroundColor: c.discret,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 12,
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 12,
            width: 110,
            height: 70,
            borderRadius: 35,
            borderWidth: 2,
            borderColor: c.principal,
            backgroundColor: c.fond,
          }}
        />
        <Animated.View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 3,
            borderColor: c.principal,
            backgroundColor: c.fond,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate }],
          }}
        >
          <View style={{ width: 30, height: 6, borderRadius: 3, backgroundColor: c.principal }} />
        </Animated.View>
      </View>
      {/* La capsule tombe, s'ouvre en deux, l'objet en sort. */}
      <Animated.View
        style={{
          height: 150,
          width: 200,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: tiree || dejaOuverte ? 1 : 0,
          transform: [{ translateY: descente }],
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: 70,
            height: 35,
            borderTopLeftRadius: 35,
            borderTopRightRadius: 35,
            backgroundColor: CAPSULE,
            top: 40,
            transform: [{ translateY: haut }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            width: 70,
            height: 35,
            borderBottomLeftRadius: 35,
            borderBottomRightRadius: 35,
            borderWidth: 2,
            borderColor: CAPSULE,
            backgroundColor: c.fond,
            top: 75,
            transform: [{ translateY: bas }],
          }}
        />
        <Animated.View style={{ opacity: sortie, transform: [{ scale: echelle }] }}>
          <ObjetProvisoire objet={objet} taille={64} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
