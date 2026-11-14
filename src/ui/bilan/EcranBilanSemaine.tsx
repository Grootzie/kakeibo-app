// Bilan de la semaine (E6), ouvert de lui-même à la première ouverture après le scellement, ou
// par le bandeau de l'accueil. Process choisit l'écran : le récapitulatif (J3.3) quand plusieurs
// semaines attendent, sinon le bilan d'une semaine en quatre temps (J3.2). Ne parle qu'au store,
// qui seul appelle le domaine et les dépôts.
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { fr } from '../../i18n/fr';
import {
  type VueBilanSemaine,
  type VueRecapitulatif,
  vueBilanSemaine,
  vueRecapitulatif,
} from '../../state/selecteurs';
import type { KakeiboStore } from '../../state/store';
import { useMoinsAnimations } from '../cloture/Tampon';
import { EcranBilanProvisoire } from './EcranBilanProvisoire';
import { EcranBilanUneSemaine } from './EcranBilanUneSemaine';
import { EcranRecapitulatif } from './EcranRecapitulatif';

export interface PropsEcranBilanSemaine {
  store: KakeiboStore;
  /** Retour à l'accueil. */
  onTerminer: () => void;
}

type Vue = { type: 'recap'; vue: VueRecapitulatif } | { type: 'semaine'; vue: VueBilanSemaine };

export function EcranBilanSemaine({ store, onTerminer }: PropsEcranBilanSemaine) {
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);
  const catalogue = useStore(store, (s) => s.catalogue);
  const reduit = useMoinsAnimations();
  const calculee = useMemo((): Vue | null => {
    if (!etat || !maintenant) return null;
    const recap = vueRecapitulatif(etat, maintenant, catalogue);
    if (recap !== null) return { type: 'recap', vue: recap };
    const semaine = vueBilanSemaine(etat, catalogue);
    return semaine === null ? null : { type: 'semaine', vue: semaine };
  }, [etat, maintenant, catalogue]);
  // Une fois les semaines marquées vues, l'écran garde ce qu'il montrait jusqu'à ce qu'on le quitte.
  const [vue, setVue] = useState<Vue | null>(calculee);
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

  const marquerVus = async (): Promise<boolean> => {
    try {
      await store.getState().marquerBilansVus();
    } catch {
      return false;
    }
    onTerminer();
    return true;
  };

  if (vue.type === 'semaine') {
    return (
      <EcranBilanUneSemaine
        key={vue.vue.semaine}
        vue={vue.vue}
        store={store}
        reduit={reduit}
        onTerminer={marquerVus}
        onRetour={onTerminer}
      />
    );
  }
  return (
    <EcranRecapitulatif
      vue={vue.vue}
      store={store}
      onContinuer={marquerVus}
      onRetour={onTerminer}
    />
  );
}
