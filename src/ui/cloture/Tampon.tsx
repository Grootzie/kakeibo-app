// Tampon qui se pose à la clôture (E4). Dessin provisoire, en attendant le lot de visuels.
// Avec « moins d'animations » (réglage du téléphone), il apparaît sur place, sans mouvement.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text } from 'react-native';

import { fr, jourCourt } from '../../i18n/fr';
import { theme } from '../theme';

const c = theme.couleurs;
/** Chute du tampon, puis fondu seul quand l'utilisateur a demandé moins d'animations. */
export const DUREE_CHUTE_MS = 450;
export const DUREE_FONDU_MS = 200;

/** Suit le réglage « réduire les animations » du téléphone. */
export function useMoinsAnimations(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    let actif = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (actif) setReduit(v);
      })
      .catch(() => undefined);
    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduit);
    return () => {
      actif = false;
      abonnement?.remove();
    };
  }, []);
  return reduit;
}

export function Tampon({ jour, reduit }: { jour: string; reduit: boolean }) {
  // Mouvement : 0 en l'air (agrandi, tourné), 1 posé. Sans animation, il est posé d'emblée.
  const [mouvement] = useState(() => new Animated.Value(reduit ? 1 : 0));
  const [opacite] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = reduit
      ? Animated.timing(opacite, { toValue: 1, duration: DUREE_FONDU_MS, useNativeDriver: true })
      : Animated.parallel([
          Animated.timing(mouvement, {
            toValue: 1,
            duration: DUREE_CHUTE_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacite, {
            toValue: 1,
            duration: DUREE_CHUTE_MS / 3,
            useNativeDriver: true,
          }),
        ]);
    animation.start();
    return () => animation.stop();
  }, [reduit, mouvement, opacite]);

  const scale = mouvement.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] });
  const rotate = mouvement.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '-8deg'] });

  return (
    <Animated.View
      testID="tampon"
      accessible
      accessibilityLabel={fr.cloture.tamponPose(jour)}
      style={{
        width: 168,
        height: 168,
        borderRadius: 84,
        borderWidth: 6,
        borderColor: c.principal,
        backgroundColor: c.fond,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: opacite,
        transform: [{ scale }, { rotate }],
      }}
    >
      <Text style={{ color: c.principal, fontSize: 26, fontWeight: '700' }}>
        {fr.cloture.tampon}
      </Text>
      <Text style={{ color: c.principal, fontSize: 17, fontWeight: '600' }}>{jourCourt(jour)}</Text>
    </Animated.View>
  );
}
