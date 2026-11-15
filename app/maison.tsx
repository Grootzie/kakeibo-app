// La maison (E8). Toucher la maison de l'accueil l'ouvre (J4.5, #84) ; l'écran lui-même (pièces,
// emplacements libres, réparation, fiche et album) arrive avec J4.6 (#85). D'ici là, un titre et
// un retour à l'accueil.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { fr } from '@/i18n/fr';
import { EcranBilanProvisoire } from '@/ui/bilan/EcranBilanProvisoire';

export default function Maison() {
  const router = useRouter();
  const retour = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return (
    <EcranBilanProvisoire testID="ecran-maison" titre={fr.ecranMaison.titre} onRetour={retour} />
  );
}
