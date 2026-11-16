// Fiche d'objet (E8, J4.7, #86) : `?id=` l'identifiant de l'objet du catalogue. Ouverte depuis la
// maison (J4.6, #85).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { EcranFicheObjet } from '@/ui/maison/EcranFicheObjet';

export default function Objet() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const retour = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/maison');
  }, [router]);
  return (
    <EcranFicheObjet
      store={kakeibo}
      itemId={typeof id === 'string' ? id : undefined}
      onRetour={retour}
    />
  );
}
