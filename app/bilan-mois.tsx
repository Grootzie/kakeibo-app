// Bilan du mois (E7), ouvert par le bandeau de l'accueil. Écran posé en attendant J3.4.
import { useRouter } from 'expo-router';

import { fr } from '@/i18n/fr';
import { useKakeibo } from '@/state/appStore';
import type { EtatKakeibo } from '@/state/store';
import { EcranBilanProvisoire } from '@/ui/bilan/EcranBilanProvisoire';

const moisAFaire = (s: EtatKakeibo): string | null => s.etat?.monthToReview ?? null;

export default function BilanMois() {
  const router = useRouter();
  const mois = useKakeibo(moisAFaire);
  return (
    <EcranBilanProvisoire
      testID="ecran-bilan-mois"
      titre={mois === null ? fr.bilan.titreMoisSans : fr.bilan.titreMois(mois)}
      onRetour={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
