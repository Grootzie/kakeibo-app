// Comprendre (E12, J5.7, #106) : `?fiche=` la fiche à ouvrir d'emblée (« En savoir plus » d'une
// carte de première fois), sinon la liste des fiches. Il s'ouvre aussi par son lien
// (kakeibo://comprendre), comme le font les parcours Maestro ; les réglages y mèneront (J5.6).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { kakeibo } from '@/state/appStore';
import { lireFicheComprendre } from '@/state/comprendre';
import { EcranComprendre } from '@/ui/comprendre/EcranComprendre';

export default function Comprendre() {
  const router = useRouter();
  const { fiche } = useLocalSearchParams<{ fiche?: string }>();
  const retour = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  const ouvrirObjet = useCallback(
    (id: string) => router.push({ pathname: '/objet', params: { id } }),
    [router],
  );
  return (
    <EcranComprendre
      // Une autre fiche demandée remonte l'écran sur elle.
      key={fiche ?? ''}
      store={kakeibo}
      fiche={lireFicheComprendre(fiche)}
      onRetour={retour}
      onOuvrirObjet={ouvrirObjet}
    />
  );
}
