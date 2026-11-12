// Bilan de la semaine (E6), ouvert par le bandeau de l'accueil : le récapitulatif quand plusieurs
// semaines attendent (J3.3), sinon l'écran d'une semaine, posé en attendant J3.2.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { EcranBilanSemaine } from '@/ui/bilan/EcranBilanSemaine';

export default function BilanSemaine() {
  const router = useRouter();
  const terminer = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return <EcranBilanSemaine store={kakeibo} onTerminer={terminer} />;
}
