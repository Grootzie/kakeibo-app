// Bilan de la semaine (E6), ouvert par le bandeau de l'accueil. Écran posé en attendant J3.2.
import { useRouter } from 'expo-router';

import { fr } from '@/i18n/fr';
import { EcranBilanProvisoire } from '@/ui/bilan/EcranBilanProvisoire';

export default function BilanSemaine() {
  const router = useRouter();
  return (
    <EcranBilanProvisoire
      testID="ecran-bilan-semaine"
      titre={fr.bilan.titreSemaine}
      onRetour={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
