// Bilan du mois (E7), ouvert par le bandeau de l'accueil, ou de lui-même à la première ouverture
// à partir du 1er du mois suivant.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { EcranBilanMois } from '@/ui/bilan/EcranBilanMois';

export default function BilanMois() {
  const router = useRouter();
  const terminer = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return <EcranBilanMois store={kakeibo} onTerminer={terminer} />;
}
