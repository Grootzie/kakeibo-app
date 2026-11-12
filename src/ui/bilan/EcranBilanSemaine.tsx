// Bilan de la semaine (E6), ouvert par le bandeau de l'accueil. Process choisit l'écran : le
// récapitulatif (J3.3) quand plusieurs semaines attendent, sinon le bilan d'une semaine, posé en
// attendant J3.2. Ne parle qu'au store, qui seul appelle le domaine et les dépôts.
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { fr } from '../../i18n/fr';
import { type VueRecapitulatif, vueRecapitulatif } from '../../state/selecteurs';
import type { KakeiboStore } from '../../state/store';
import { EcranBilanProvisoire } from './EcranBilanProvisoire';
import { EcranRecapitulatif } from './EcranRecapitulatif';

export interface PropsEcranBilanSemaine {
  store: KakeiboStore;
  /** Retour à l'accueil. */
  onTerminer: () => void;
}

export function EcranBilanSemaine({ store, onTerminer }: PropsEcranBilanSemaine) {
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);
  const catalogue = useStore(store, (s) => s.catalogue);
  const calculee = useMemo(
    () => (etat && maintenant ? vueRecapitulatif(etat, maintenant, catalogue) : null),
    [etat, maintenant, catalogue],
  );
  // Une fois les semaines marquées vues, l'écran garde ce qu'il montrait jusqu'à ce qu'on le quitte.
  const [vue, setVue] = useState<VueRecapitulatif | null>(calculee);
  if (calculee !== null && calculee !== vue) setVue(calculee);

  if (vue === null) {
    return (
      <EcranBilanProvisoire
        testID="ecran-bilan-semaine"
        titre={fr.bilan.titreSemaine}
        onRetour={onTerminer}
      />
    );
  }

  const continuer = async (): Promise<boolean> => {
    try {
      await store.getState().marquerBilansVus();
    } catch {
      return false;
    }
    onTerminer();
    return true;
  };

  return <EcranRecapitulatif vue={vue} onContinuer={continuer} onRetour={onTerminer} />;
}
