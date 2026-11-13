// Machine à capsules et jeton du soir (E4, E5, J3.8) : à chaque clôture, en même temps que le
// tampon, un jeton tombe dans la fente de la machine (0,4 s). Dessin provisoire, en attendant le
// lot de visuels. Avec « moins d'animations », le jeton s'affiche directement dans la fente.
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { fr } from '../../i18n/fr';
import { theme } from '../theme';

const c = theme.couleurs;
/** Chute du jeton dans la fente (Fiche des visuels : 0,4 s, avec le tampon). */
export const DUREE_CHUTE_JETON_MS = 400;
/** Hauteur de la chute, en points, jusqu'à la fente. */
const HAUTEUR_CHUTE = 96;
const JETON = 22;
const LARGEUR = 132;
const GLOBE = 104;
const CORPS = 64;
/** Le jeton finit sur la fente, au milieu de la moitié gauche du corps. */
const FENTE_X = LARGEUR / 4;
const FENTE_Y = GLOBE + CORPS / 2;
const FENTE = JETON + 6;
const TIRETTE = 34;
const OR = '#C9A227';

export function Jeton({ reduit }: { reduit: boolean }) {
  // Chute : 0 au-dessus de la machine, 1 dans la fente. Sans animation, il y est d'emblée.
  const [chute] = useState(() => new Animated.Value(reduit ? 1 : 0));

  useEffect(() => {
    if (reduit) return;
    const animation = Animated.timing(chute, {
      toValue: 1,
      duration: DUREE_CHUTE_JETON_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduit, chute]);

  const translateY = chute.interpolate({ inputRange: [0, 1], outputRange: [-HAUTEUR_CHUTE, 0] });

  return (
    <View
      testID="machine"
      accessible
      accessibilityLabel={fr.cloture.machineLibelle}
      style={{ width: LARGEUR, height: GLOBE + CORPS, alignItems: 'center' }}
    >
      {/* Le globe de la machine. */}
      <View
        style={{
          width: GLOBE,
          height: GLOBE,
          borderRadius: GLOBE / 2,
          borderWidth: 4,
          borderColor: c.principal,
          backgroundColor: c.discret,
        }}
      />
      {/* Le corps, avec la fente à gauche et la tirette à droite. */}
      <View
        style={{ width: LARGEUR, height: CORPS, borderRadius: 8, backgroundColor: c.principal }}
      >
        <View
          testID="fente"
          style={{
            position: 'absolute',
            left: FENTE_X - FENTE / 2,
            top: CORPS / 2 - 3,
            width: FENTE,
            height: 6,
            borderRadius: 3,
            backgroundColor: c.surPrincipal,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: (3 * LARGEUR) / 4 - TIRETTE / 2,
            top: CORPS / 2 - TIRETTE / 2,
            width: TIRETTE,
            height: TIRETTE,
            borderRadius: TIRETTE / 2,
            borderWidth: 4,
            borderColor: c.surPrincipal,
          }}
        />
      </View>
      <Animated.View
        testID="jeton"
        style={{
          position: 'absolute',
          left: FENTE_X - JETON / 2,
          top: FENTE_Y - JETON / 2,
          width: JETON,
          height: JETON,
          borderRadius: JETON / 2,
          borderWidth: 3,
          borderColor: c.principal,
          backgroundColor: OR,
          transform: [{ translateY }],
        }}
      />
    </View>
  );
}
