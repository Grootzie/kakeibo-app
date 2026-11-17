// Réglages (E10, J5.6) : ouverts depuis l'en-tête de l'accueil, ou par leur lien
// (kakeibo://reglages). « Comprendre » ouvre E12 ; après « Tout effacer », la bienvenue (E1)
// remplace tout : le bouton retour ne ramène pas aux réglages.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Linking } from 'react-native';

import { kakeibo } from '@/state/appStore';
import { EcranReglages } from '@/ui/reglages/EcranReglages';

export default function Reglages() {
  const router = useRouter();
  const retour = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  const comprendre = useCallback(() => router.push('/comprendre'), [router]);
  const efface = useCallback(() => {
    router.dismissAll();
    router.replace('/bienvenue');
  }, [router]);
  const reglagesTelephone = useCallback(() => {
    Linking.openSettings().catch((erreur: unknown) => {
      if (__DEV__) console.warn(erreur);
    });
  }, []);
  return (
    <EcranReglages
      store={kakeibo}
      onRetour={retour}
      onComprendre={comprendre}
      onEfface={efface}
      onOuvrirReglagesTelephone={reglagesTelephone}
    />
  );
}
