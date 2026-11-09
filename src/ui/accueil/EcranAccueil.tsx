// Accueil relié à l'état : vue de l'accueil, feuille « Noter une dépense » (E3) et
// message « Annuler ». Ne parle qu'au store, qui seul appelle le domaine et les dépôts.
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { joursDepense, vueAccueil } from '../../state/selecteurs';
import type { KakeiboStore } from '../../state/store';
import { type DepenseSaisie, FeuilleDepense } from '../depense/FeuilleDepense';
import { MessageAnnuler } from '../depense/MessageAnnuler';
import { CarteExplication } from '../explication/CarteExplication';
import { useCarteExplication } from '../explication/useCarteExplication';
import { Accueil } from './Accueil';

interface DepenseNotee {
  id: string;
  montant: number;
  categorie: DepenseSaisie['category'];
}

export interface PropsEcranAccueil {
  store: KakeiboStore;
  onAppuiLongDate?: () => void;
  /** Ouvre « Clôturer ma journée » (E4). */
  onCloturer?: () => void;
  /** Ouvre « Rattraper un jour » (E5) sur ce jour. */
  onRattraper?: (jour: string) => void;
  /** Ouvre le bilan de la semaine (E6). */
  onBilanSemaine?: () => void;
  /**
   * Ouvre le bilan du mois (E7) : par le bandeau, et de lui-même, une fois par mois à faire,
   * quand il est le premier bilan prêt (après ceux des semaines).
   */
  onBilanMois?: () => void;
  /** Faux quand un autre écran est par-dessus : les cartes de première fois attendent. */
  visible?: boolean;
  children?: ReactNode;
}

export function EcranAccueil({
  store,
  onAppuiLongDate,
  onCloturer,
  onRattraper,
  onBilanSemaine,
  onBilanMois,
  visible = true,
  children,
}: PropsEcranAccueil) {
  const [feuille, setFeuille] = useState(false);
  const [notee, setNotee] = useState<DepenseNotee | null>(null);
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);
  // Pas de carte pendant que la feuille « Noter une dépense » est ouverte.
  const { carte, fermer } = useCarteExplication(store, undefined, visible && !feuille);

  const vue = useMemo(
    () => (etat && maintenant ? vueAccueil(etat, maintenant) : null),
    [etat, maintenant],
  );
  // E7 s'ouvre de lui-même à la première ouverture à partir du 1er du mois suivant : une fois
  // par mois à faire, tant que l'accueil reste monté ; ensuite le bandeau reste.
  const bilanMoisOuvert = useRef<string | null>(null);
  const moisAFaire = vue?.bandeau?.type === 'bilan_mois' ? vue.bandeau.mois : null;
  useEffect(() => {
    if (!visible || moisAFaire === null || bilanMoisOuvert.current === moisAFaire) return;
    bilanMoisOuvert.current = moisAFaire;
    onBilanMois?.();
  }, [visible, moisAFaire, onBilanMois]);

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
      onCloturer={onCloturer}
      onRattraper={onRattraper}
      onBilanSemaine={onBilanSemaine}
      onBilanMois={onBilanMois}
      explication={carte && <CarteExplication key={carte} id={carte} onFermer={fermer} />}
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
