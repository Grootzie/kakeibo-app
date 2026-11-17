// Bienvenue (E1), à la première ouverture : l'accueil y renvoie tant qu'aucun budget n'est posé.
// À la fin, l'accueil la remplace : le bouton retour ne la rouvre pas.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { EcranBienvenue } from '@/ui/bienvenue/EcranBienvenue';

export default function Bienvenue() {
  const router = useRouter();
  const arriver = useCallback(() => {
    router.replace('/');
  }, [router]);
  return <EcranBienvenue store={kakeibo} onArrivee={arriver} />;
}
