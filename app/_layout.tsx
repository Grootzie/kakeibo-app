import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { kakeibo } from '@/state/appStore';
import { serviceRappels } from '@/state/notifications';
import { useOuvrirDepuisRappel } from '@/ui/useOuvrirDepuisRappel';

/** Chaque ouverture, et chaque retour au premier plan, passe par process (ordre de traitement). */
function ouvrir() {
  kakeibo
    .getState()
    .ouvrir()
    .catch((erreur: unknown) => {
      if (__DEV__) console.warn(erreur);
    });
}

export default function RootLayout() {
  const router = useRouter();
  // Toucher le rappel du soir ouvre directement E4 sur son jour (E5 s'il est passé et rattrapable).
  useOuvrirDepuisRappel(serviceRappels, (jour) =>
    router.push({ pathname: '/cloturer', params: { jour } }),
  );
  useEffect(() => {
    ouvrir();
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') ouvrir();
    });
    return () => abonnement.remove();
  }, []);
  // L'accueil a son propre en-tête (E2) : pas de barre de titre du routeur.
  return <Stack screenOptions={{ headerShown: false }} />;
}
