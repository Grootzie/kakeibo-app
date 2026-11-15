// La maison (E8, J4.6, #85) : toucher la maison de l'accueil l'ouvre (J4.5, #84) ; elle s'ouvre
// aussi par son lien (kakeibo://maison), comme le font les parcours Maestro.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { EcranMaison } from '@/ui/maison/EcranMaison';

export default function Maison() {
  const router = useRouter();
  const retour = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  const ouvrirObjet = useCallback(
    (id: string) => router.push({ pathname: '/objet', params: { id } }),
    [router],
  );
  const ouvrirAlbum = useCallback(() => {
    router.push('/album');
  }, [router]);
  return (
    <EcranMaison
      store={kakeibo}
      onRetour={retour}
      onOuvrirObjet={ouvrirObjet}
      onOuvrirAlbum={ouvrirAlbum}
    />
  );
}
