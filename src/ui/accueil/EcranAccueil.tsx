// Accueil relié à l'état : vue de l'accueil, feuille « Noter une dépense » (E3) et
// message « Annuler ». Ne parle qu'au store, qui seul appelle le domaine et les dépôts.
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { joursDepense, vueAccueil } from '../../state/selecteurs';
import type { KakeiboStore } from '../../state/store';
import { type DepenseSaisie, FeuilleDepense } from '../depense/FeuilleDepense';
import { MessageAnnuler } from '../depense/MessageAnnuler';
import { Accueil } from './Accueil';

interface DepenseNotee {
  id: string;
  montant: number;
  categorie: DepenseSaisie['category'];
}

export interface PropsEcranAccueil {
  store: KakeiboStore;
  onAppuiLongDate?: () => void;
  children?: ReactNode;
}

export function EcranAccueil({ store, onAppuiLongDate, children }: PropsEcranAccueil) {
  const [feuille, setFeuille] = useState(false);
  const [notee, setNotee] = useState<DepenseNotee | null>(null);
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);

  const vue = useMemo(
    () => (etat && maintenant ? vueAccueil(etat, maintenant) : null),
    [etat, maintenant],
  );
  const jours = useMemo(
    () => (etat && maintenant ? joursDepense(etat, maintenant) : []),
    [etat, maintenant],
  );

  const enregistrer = async (d: DepenseSaisie): Promise<boolean> => {
    const { id, refusal } = await store.getState().noterDepense(d);
    if (refusal !== null) return false;
    setNotee({ id, montant: d.amount, categorie: d.category });
    return true;
  };
  const effacer = useCallback(() => setNotee(null), []);
  const annuler = (id: string) => {
    setNotee(null);
    void store.getState().supprimerDepense(id);
  };

  return (
    <Accueil
      vue={vue}
      onAppuiLongDate={onAppuiLongDate}
      onNoterDepense={() => setFeuille(true)}
      message={
        notee && (
          <MessageAnnuler
            key={notee.id}
            montant={notee.montant}
            categorie={notee.categorie}
            onAnnuler={() => annuler(notee.id)}
            onFin={effacer}
          />
        )
      }
    >
      {children}
      {feuille && maintenant && (
        <FeuilleDepense
          jours={jours}
          aujourdhui={maintenant.day}
          onEnregistrer={enregistrer}
          onFermer={() => setFeuille(false)}
        />
      )}
    </Accueil>
  );
}
