// Carnet (E9, J5.3, #102) : ouvert depuis l'en-tête de l'accueil ; il s'ouvre aussi par son lien
// (kakeibo://carnet).
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { EcranCarnet } from '@/ui/carnet/EcranCarnet';

export default function Carnet() {
  const router = useRouter();
  const retour = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return <EcranCarnet store={kakeibo} onRetour={retour} />;
}
