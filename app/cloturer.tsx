// Clôturer ma journée (E4). `?jour=AAAA-MM-JJ` ouvre un jour passé : « Rattraper un jour » (E5),
// seulement s'il est encore rattrapable, sinon retour à l'accueil ; sans paramètre, c'est aujourd'hui (bouton de l'accueil, notification du soir avec J2.6).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { EcranCloture } from '@/ui/cloture/EcranCloture';

export default function Cloturer() {
  const router = useRouter();
  const { jour } = useLocalSearchParams<{ jour?: string }>();
  const terminer = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return (
    <EcranCloture
      store={kakeibo}
      jour={typeof jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : undefined}
      onTerminer={terminer}
    />
  );
}
