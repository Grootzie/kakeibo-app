// Clôturer ma journée (E4) : dépenses du jour et total par catégorie, « Ajouter une dépense
// oubliée » (E3 sur ce jour), un seul bouton de validation, puis le tampon, le jeton qui tombe
// dans la machine (J3.8) et retour à l'accueil.
// Si la clôture complète la réparation d'un objet, l'annonce « Réparée à l'or, … » suit le tampon
// (emplacement A décidé par le propriétaire, #66), avec la carte « Première réparation » la
// première fois, et l'écran attend « Continuer » avant de revenir à l'accueil.
// Pour un jour passé, c'est « Rattraper un jour » (E5) : le même écran, avec un titre explicite,
// qui ne s'ouvre que tant que le jour est rattrapable (jusqu'au lundi 12:00 qui suit sa semaine).
// Ne parle qu'au store, qui seul appelle le domaine et les dépôts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import type { DayKey } from '../../domain/scellement';
import type { Refusal } from '../../domain/traitement';
import { fr } from '../../i18n/fr';
import {
  type ObjetNomme,
  joursDepense,
  objetsReparesEntre,
  vueCloture,
} from '../../state/selecteurs';
import type { KakeiboStore } from '../../state/store';
import { type DepenseSaisie, FeuilleDepense } from '../depense/FeuilleDepense';
import { MessageAnnuler } from '../depense/MessageAnnuler';
import { CarteDuMoment, CarteExplication } from '../explication/CarteExplication';
import { useCarteExplication } from '../explication/useCarteExplication';
import { theme } from '../theme';
import { ObjetProvisoire } from '../bilan/ObjetProvisoire';
import { Jeton } from './Jeton';
import { Tampon, useMoinsAnimations } from './Tampon';

/** Temps pendant lequel le tampon reste à l'écran avant le retour à l'accueil. */
export const DUREE_TAMPON_MS = 1600;

const c = theme.couleurs;
const ESPACE = 16;

export interface PropsEcranCloture {
  store: KakeiboStore;
  /** Jour à clôturer ; aujourd'hui par défaut. Un jour passé ouvre E5, s'il est rattrapable. */
  jour?: DayKey;
  /** Retour à l'accueil, après le tampon ou par « Retour ». */
  onTerminer: () => void;
}

interface DepenseNotee {
  id: string;
  montant: number;
  categorie: DepenseSaisie['category'];
}

const PROPOSEES = ['first_expense'] as const;
const REPARATION = ['first_repair'] as const;
const MOMENT_REPARATION = { first_repair: true } as const;

type RefusCloture = keyof typeof fr.cloture.refus;
const messageRefus = (r: Refusal): string =>
  fr.cloture.refus[r in fr.cloture.refus ? (r as RefusCloture) : 'autre'];

export function EcranCloture({ store, jour, onTerminer }: PropsEcranCloture) {
  const [feuille, setFeuille] = useState(false);
  const [notee, setNotee] = useState<DepenseNotee | null>(null);
  const [refus, setRefus] = useState<Refusal | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [pose, setPose] = useState(false);
  // Objets que cette clôture a réparés à l'or ; annoncés une fois le tampon posé.
  const [reparees, setReparees] = useState<ObjetNomme[]>([]);
  const [annonce, setAnnonce] = useState(false);
  // Sans jour donné, c'est aujourd'hui : rien à vérifier. Sinon, le store dit d'abord, à l'heure
  // actuelle, si ce jour s'ouvre encore ; sinon retour à l'accueil, sans rien montrer.
  const [acces, setAcces] = useState<'verification' | 'ouvert' | 'ferme'>(
    jour === undefined ? 'ouvert' : 'verification',
  );
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);
  const lignes = useStore(store, (s) => s.depenses);
  const catalogue = useStore(store, (s) => s.catalogue);
  const reduit = useMoinsAnimations();
  // Seule « Première dépense » peut naître ici (dépense oubliée) ; le premier tampon s'explique
  // à l'accueil, après l'animation du tampon.
  const { carte, fermer } = useCarteExplication(
    store,
    PROPOSEES,
    acces === 'ouvert' && !feuille && !pose,
  );

  const jourVu = jour ?? maintenant?.day;
  const vue = useMemo(
    () => (etat && maintenant && jourVu ? vueCloture(etat, lignes, jourVu, maintenant) : null),
    [etat, maintenant, lignes, jourVu],
  );
  const jours = useMemo(
    () => (etat && maintenant ? joursDepense(etat, maintenant) : []),
    [etat, maintenant],
  );

  useEffect(() => {
    if (jour === undefined) return;
    let actif = true;
    void store
      .getState()
      .ouvrirJour(jour)
      .then((mode) => {
        if (actif) setAcces(mode === null ? 'ferme' : 'ouvert');
      });
    return () => {
      actif = false;
    };
  }, [store, jour]);

  useEffect(() => {
    if (acces === 'ferme') onTerminer();
  }, [acces, onTerminer]);

  // Le tampon posé reste un instant, puis retour à l'accueil ; ou l'annonce de la réparation.
  useEffect(() => {
    if (!pose) return;
    const minuteur = setTimeout(() => {
      if (reparees.length === 0) {
        onTerminer();
        return;
      }
      AccessibilityInfo.announceForAccessibility(
        reparees.map((o) => fr.messages.reparation(o)).join(' '),
      );
      setAnnonce(true);
    }, DUREE_TAMPON_MS);
    return () => clearTimeout(minuteur);
  }, [pose, reparees, onTerminer]);

  const cloturer = async () => {
    if (!vue || envoi || pose) return;
    setEnvoi(true);
    setRefus(null);
    const avant = store.getState().etat;
    const refusal = await store.getState().cloturerJour(vue.jour);
    setEnvoi(false);
    if (refusal !== null) {
      setRefus(refusal);
      return;
    }
    const apres = store.getState().etat;
    setReparees(apres === null ? [] : objetsReparesEntre(avant, apres, catalogue));
    AccessibilityInfo.announceForAccessibility(fr.cloture.tamponEtJeton(vue.jour));
    setPose(true);
  };

  const enregistrer = async (d: DepenseSaisie): Promise<boolean> => {
    const { id, refusal } = await store.getState().noterDepense(d);
    if (refusal !== null) return false;
    setNotee({ id, montant: d.amount, categorie: d.category });
    setRefus(null);
    return true;
  };
  const effacer = useCallback(() => setNotee(null), []);
  const annuler = (id: string) => {
    setNotee(null);
    void store.getState().supprimerDepense(id);
  };

  const bouton: ViewStyle = {
    minHeight: theme.zoneTactileMin,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: ESPACE,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const validation = vue?.cloture
    ? fr.cloture.journeeCloturee
    : vue?.validation === 'tout_note'
      ? fr.cloture.toutNote
      : fr.cloture.rienDepense;
  const inactif = !vue || vue.cloture || envoi || pose;

  if (acces !== 'ouvert') {
    return (
      <SafeAreaView
        testID="ecran-cloture"
        edges={['top', 'bottom']}
        style={{ flex: 1, backgroundColor: c.fond }}
      />
    );
  }

  return (
    <SafeAreaView
      testID="ecran-cloture"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView contentContainerStyle={{ padding: ESPACE, gap: ESPACE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fr.cloture.retourLibelle}
            onPress={onTerminer}
            style={{
              minHeight: theme.zoneTactileMin,
              minWidth: theme.zoneTactileMin,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.texte }}>{fr.cloture.retour}</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{ flex: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
          >
            {vue?.rattrapage ? fr.cloture.titreRattrapage(vue.jour) : fr.cloture.titre}
          </Text>
        </View>
        {vue && !vue.rattrapage && (
          <Text style={{ color: c.texteDiscret }}>{fr.cloture.date(vue.jour)}</Text>
        )}

        {vue && (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={{ fontWeight: '600', color: c.texte }}>
              {fr.cloture.depensesDuJour}
            </Text>
            {vue.depenses.length === 0 ? (
              <Text style={{ color: c.texteDiscret }}>{fr.cloture.aucuneDepense}</Text>
            ) : (
              vue.depenses.map((d) => (
                <Text key={d.id} style={{ color: c.texte }}>
                  {fr.cloture.depense(d.amount, fr.categories[d.category].nom, d.note)}
                </Text>
              ))
            )}
          </View>
        )}

        {vue && vue.totaux.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={{ fontWeight: '600', color: c.texte }}>
              {fr.cloture.totauxTitre}
            </Text>
            {vue.totaux.map((t) => (
              <View
                key={t.categorie}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: theme.categories[t.categorie].couleur,
                  }}
                />
                <Text style={{ color: c.texte }}>
                  {fr.cloture.totalCategorie(fr.categories[t.categorie].nom, t.total)}
                </Text>
              </View>
            ))}
            <Text style={{ color: c.texte, fontWeight: '600' }}>{fr.cloture.total(vue.total)}</Text>
          </View>
        )}

        {carte && !pose && <CarteExplication key={carte} id={carte} onFermer={fermer} />}

        {notee && !pose && (
          <MessageAnnuler
            key={notee.id}
            montant={notee.montant}
            categorie={notee.categorie}
            onAnnuler={() => annuler(notee.id)}
            onFin={effacer}
          />
        )}

        {vue?.peutAjouter && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fr.cloture.ajouterOubliee}
            disabled={pose}
            accessibilityState={{ disabled: pose }}
            onPress={() => setFeuille(true)}
            style={{ ...bouton, borderWidth: 2, borderColor: c.principal, backgroundColor: c.fond }}
          >
            <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>
              {fr.cloture.ajouterOubliee}
            </Text>
          </Pressable>
        )}

        {refus && (
          <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
            {messageRefus(refus)}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={validation}
          disabled={inactif}
          accessibilityState={{ disabled: inactif }}
          onPress={() => void cloturer()}
          style={{
            ...bouton,
            backgroundColor: vue?.cloture ? c.discret : c.principal,
          }}
        >
          <Text
            style={{
              color: vue?.cloture ? c.texte : c.surPrincipal,
              fontSize: 17,
              fontWeight: '600',
            }}
          >
            {validation}
          </Text>
        </Pressable>
      </ScrollView>

      {pose && vue && !annonce && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
          }}
        >
          <Tampon jour={vue.jour} reduit={reduit} />
          <Jeton reduit={reduit} />
        </View>
      )}

      {annonce && (
        <View
          testID="annonce-reparation"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: c.fond,
          }}
        >
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                padding: ESPACE,
                gap: ESPACE,
              }}
            >
              {reparees.map((o) => (
                <View key={o.id} style={{ alignItems: 'center', gap: 12 }}>
                  <ObjetProvisoire objet={o} taille={96} repare libelle={fr.messages.repare(o)} />
                  <Text
                    accessibilityRole="header"
                    style={{ color: c.texte, fontSize: 18, fontWeight: '600', textAlign: 'center' }}
                  >
                    {fr.messages.reparation(o)}
                  </Text>
                </View>
              ))}
              <CarteDuMoment store={store} proposees={REPARATION} moments={MOMENT_REPARATION} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fr.cloture.continuerLibelle}
                onPress={onTerminer}
                style={{ ...bouton, backgroundColor: c.principal }}
              >
                <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
                  {fr.cloture.continuer}
                </Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      )}

      {feuille && maintenant && vue && (
        <FeuilleDepense
          jours={jours}
          aujourdhui={maintenant.day}
          jourInitial={vue.jour}
          onEnregistrer={enregistrer}
          onFermer={() => setFeuille(false)}
        />
      )}
    </SafeAreaView>
  );
}
