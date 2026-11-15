// Album des années passées (E8, J4.8, #87). L’écran de la maison (E8, J4.6, #85) y donne accès ;
// il s'ouvre aussi par son lien (kakeibo://album), comme le font les parcours Maestro.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { EcranAlbum } from '@/ui/album/EcranAlbum';

export default function Album() {
  const router = useRouter();
  const retour = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return <EcranAlbum store={kakeibo} onRetour={retour} />;
}
