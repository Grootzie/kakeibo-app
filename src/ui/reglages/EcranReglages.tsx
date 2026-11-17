// Réglages (E10, J5.6) : le budget du mois (revenus, épargne visée, dépenses récurrentes à
// ajouter, modifier ou arrêter), le rappel du soir, les données (tout effacer, avec double
// confirmation) et À propos (la méthode, Comprendre, la confidentialité, les mentions). Pas de
// ligne Abonnement ni Publicité avant J7. Ne parle qu'au store, qui seul appelle le domaine.
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  type AccessibilityActionEvent,
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import type { RecurringChargeRow } from '../../data/repositories';
import { formatEuros, fr } from '../../i18n/fr';
import {
  type SaisieCharge,
  apercuReglages,
  chargeSaisieValide,
  decalerJourCharge,
  vueBudgetReglages,
} from '../../state/reglages';
import { HEURE_RAPPEL_DEFAUT, type KakeiboStore } from '../../state/store';
import { ReglageHeure } from '../ReglageHeure';
import { ecrireMontant, lireMontant } from '../depense/montant';
import { theme } from '../theme';

const c = theme.couleurs;
const r = fr.reglages;
const ESPACE = 16;
const ACTIONS_JOUR = [{ name: 'increment' }, { name: 'decrement' }];

const styleBouton = {
  minHeight: theme.zoneTactileMin,
  borderRadius: 8,
  paddingHorizontal: ESPACE,
  paddingVertical: 12,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const styleBoutonPrincipal = { ...styleBouton, backgroundColor: c.principal };
const styleBoutonSecondaire = { ...styleBouton, borderWidth: 1, borderColor: c.texte };

export interface PropsEcranReglages {
  store: KakeiboStore;
  onRetour: () => void;
  /** Ouvre Comprendre (E12). */
  onComprendre: () => void;
  /** Tout est effacé : la bienvenue (E1) s'ouvre. */
  onEfface: () => void;
  /** Ouvre les réglages du téléphone, pour autoriser les notifications. */
  onOuvrirReglagesTelephone: () => void;
}

export function EcranReglages({
  store,
  onRetour,
  onComprendre,
  onEfface,
  onOuvrirReglagesTelephone,
}: PropsEcranReglages) {
  return (
    <SafeAreaView
      testID="ecran-reglages"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: ESPACE,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={r.retourLibelle}
          onPress={onRetour}
          style={{ ...styleBouton, paddingHorizontal: 0, alignItems: 'flex-start' }}
        >
          <Text style={{ color: c.texte, textDecorationLine: 'underline' }}>{r.retour}</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 24, fontWeight: '600', color: c.texte }}
        >
          {r.titre}
        </Text>
      </View>
      <ScrollView
        testID="ecran-reglages-defilement"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: ESPACE, gap: ESPACE * 2 }}
      >
        <SectionBudget store={store} />
        <SectionRappel store={store} onOuvrirReglagesTelephone={onOuvrirReglagesTelephone} />
        <SectionDonnees store={store} onEfface={onEfface} />
        <SectionAPropos onComprendre={onComprendre} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', color: c.texte }}>
        {titre}
      </Text>
      {children}
    </View>
  );
}

function Texte({ children, discret = false }: { children: ReactNode; discret?: boolean }) {
  return (
    <Text style={{ color: discret ? c.texteDiscret : c.texte, lineHeight: 22 }}>{children}</Text>
  );
}

function Bouton({
  titre,
  libelle,
  onPress,
  principal = false,
  inactif = false,
}: {
  titre: string;
  libelle?: string;
  onPress: () => void;
  principal?: boolean;
  inactif?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle ?? titre}
      accessibilityState={{ disabled: inactif }}
      disabled={inactif}
      onPress={onPress}
      style={{
        ...(principal ? styleBoutonPrincipal : styleBoutonSecondaire),
        opacity: inactif ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          color: principal ? c.surPrincipal : c.texte,
          fontSize: 17,
          fontWeight: principal ? '600' : 'normal',
          textAlign: 'center',
        }}
      >
        {titre}
      </Text>
    </Pressable>
  );
}

/** Un montant au pavé numérique, comme en E1 et E3. */
function ChampMontant({
  nom,
  valeur,
  onChange,
}: {
  nom: string;
  valeur: string;
  onChange: (texte: string) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: c.texte, fontWeight: '600' }}>{nom}</Text>
      <TextInput
        keyboardType="decimal-pad"
        accessibilityLabel={r.budget.champLibelle(nom)}
        value={valeur}
        onChangeText={onChange}
        maxLength={9}
        placeholder={fr.depense.montantExemple}
        placeholderTextColor={c.texteDiscret}
        style={{
          minHeight: theme.zoneTactileMin,
          fontSize: 22,
          fontWeight: '600',
          color: c.texte,
          borderBottomWidth: 2,
          borderColor: c.texte,
        }}
      />
    </View>
  );
}

/** Vide : 0 € pour l'épargne ; les revenus, eux, sont requis. */
const lire = (texte: string, videVautZero: boolean) =>
  videVautZero && texte.trim() === '' ? 0 : lireMontant(texte);

/** Fiche d'une dépense récurrente : nouvelle (id null) ou existante. */
interface Fiche {
  id: string | null;
  libelle: string;
  montant: string;
  frequence: RecurringChargeRow['frequency'];
  jour: number;
}

const ficheVide: Fiche = { id: null, libelle: '', montant: '', frequence: 'monthly', jour: 1 };

const ficheDe = (ch: RecurringChargeRow): Fiche => ({
  id: ch.id,
  libelle: ch.label,
  montant: ecrireMontant(ch.amount),
  frequence: ch.frequency,
  jour: ch.day,
});

function SectionBudget({ store }: { store: KakeiboStore }) {
  const etat = useStore(store, (s) => s.etat);
  const charges = useStore(store, (s) => s.charges);
  const maintenant = useStore(store, (s) => s.maintenant);
  const vue =
    etat !== null && maintenant !== null ? vueBudgetReglages(etat, charges, maintenant) : null;

  const [revenus, setRevenus] = useState(null as string | null);
  const [epargne, setEpargne] = useState(null as string | null);
  // Le message s'affiche sous le bouton qui l'a fait naître : visible aussitôt, clavier fermé.
  const [message, setMessage] = useState(
    null as { texte: string; sous: 'budget' | 'charges' } | null,
  );
  const [fiche, setFiche] = useState(null as Fiche | null);
  const [envoi, setEnvoi] = useState(false);

  if (vue === null) return null;

  // Tant que l'utilisateur n'a rien tapé, les champs montrent la version qui s'appliquera.
  const texteRevenus = revenus ?? ecrireMontant(vue.income);
  const texteEpargne = epargne ?? ecrireMontant(vue.savingsGoal);
  const apercu = apercuReglages(
    { income: lire(texteRevenus, false), savingsGoal: lire(texteEpargne, true) },
    vue,
  );

  const enregistrer = async () => {
    const income = lire(texteRevenus, false);
    const savingsGoal = lire(texteEpargne, true);
    if (envoi || income === null || savingsGoal === null) return;
    Keyboard.dismiss();
    setEnvoi(true);
    const refus = await store.getState().reviserBudget({ income, savingsGoal });
    setEnvoi(false);
    if (refus === null) {
      setRevenus(null);
      setEpargne(null);
      setMessage({ texte: r.budget.enregistre(vue.changementLe), sous: 'budget' });
    } else {
      setMessage({ texte: r.budget.refus, sous: 'budget' });
    }
  };

  const changer = (set: (t: string) => void) => (t: string) => {
    set(t);
    setMessage(null);
  };

  return (
    <Section titre={r.budget.titre}>
      <ChampMontant nom={r.budget.revenus} valeur={texteRevenus} onChange={changer(setRevenus)} />
      <ChampMontant nom={r.budget.epargne} valeur={texteEpargne} onChange={changer(setEpargne)} />
      <Text style={{ color: c.texte }}>{r.budget.chargesFixes(vue.fixedCosts)}</Text>
      <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
        {apercu.budgetMois !== null && (
          <Text style={{ color: c.texte, fontSize: 18, fontWeight: '600' }}>
            {r.budget.budgetMois(apercu.budgetMois)}
          </Text>
        )}
        {apercu.budgetMois !== null && apercu.budgetMois <= 0 && (
          <Texte>{r.budget.budgetPositif}</Texte>
        )}
      </View>
      <Texte discret>{r.budget.quand(vue.changementLe)}</Texte>
      <Bouton
        titre={r.budget.enregistrer}
        principal
        inactif={!apercu.peutEnregistrer || envoi}
        onPress={() => void enregistrer()}
      />
      {message?.sous === 'budget' && <Message texte={message.texte} />}

      <Text
        accessibilityRole="header"
        style={{ fontSize: 17, fontWeight: '600', color: c.texte, marginTop: 8 }}
      >
        {r.charges.titre}
      </Text>
      <Texte discret>{r.charges.aide}</Texte>
      {vue.charges.length === 0 && <Texte>{r.charges.aucune}</Texte>}
      {vue.charges.map((ch) => {
        const echeance = r.charges.echeance(ch.frequency, ch.day);
        return (
          <Pressable
            key={ch.id}
            accessibilityRole="button"
            accessibilityLabel={r.charges.ligneLibelle(ch.label, ch.amount, echeance)}
            accessibilityHint={r.charges.ligneIndice}
            onPress={() => {
              setFiche(ficheDe(ch));
              setMessage(null);
            }}
            style={{
              minHeight: theme.zoneTactileMin,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              columnGap: 12,
              padding: 12,
              borderRadius: 8,
              backgroundColor: c.discret,
            }}
          >
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Text style={{ color: c.texte, fontWeight: '600' }}>{ch.label}</Text>
              <Text style={{ color: c.texte }}>{echeance}</Text>
            </View>
            <Text style={{ color: c.texte, fontWeight: '600' }}>{formatEuros(ch.amount)}</Text>
          </Pressable>
        );
      })}
      {fiche === null ? (
        <Bouton
          titre={r.charges.ajouter}
          onPress={() => {
            setFiche(ficheVide);
            setMessage(null);
          }}
        />
      ) : (
        <FicheCharge
          store={store}
          fiche={fiche}
          onChange={setFiche}
          onFermer={(fait) => {
            setFiche(null);
            if (fait) setMessage({ texte: r.budget.enregistre(vue.changementLe), sous: 'charges' });
          }}
        />
      )}
      {message?.sous === 'charges' && <Message texte={message.texte} />}
    </Section>
  );
}

function Message({ texte }: { texte: string }) {
  return (
    <Text accessibilityLiveRegion="polite" style={{ color: c.texte, fontWeight: '600' }}>
      {texte}
    </Text>
  );
}

function FicheCharge({
  store,
  fiche,
  onChange,
  onFermer,
}: {
  store: KakeiboStore;
  fiche: Fiche;
  onChange: (f: Fiche) => void;
  /** `fait` : une dépense récurrente a été enregistrée ou arrêtée. */
  onFermer: (fait: boolean) => void;
}) {
  const [refus, setRefus] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const saisie: SaisieCharge = {
    label: fiche.libelle,
    amount: lireMontant(fiche.montant),
    frequency: fiche.frequence,
    day: fiche.jour,
  };
  const valide = chargeSaisieValide(saisie);
  const echeance = r.charges.echeance(fiche.frequence, fiche.jour);
  const maj = (champs: Partial<Fiche>) => {
    onChange({ ...fiche, ...champs });
    setRefus(false);
  };
  const decaler = (delta: number) =>
    maj({ jour: decalerJourCharge(fiche.frequence, fiche.jour, delta) });
  const action = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') decaler(1);
    if (e.nativeEvent.actionName === 'decrement') decaler(-1);
  };

  const enregistrer = async () => {
    if (!valide || envoi || saisie.amount === null) return;
    Keyboard.dismiss();
    setEnvoi(true);
    const charge = {
      label: saisie.label,
      amount: saisie.amount,
      frequency: saisie.frequency,
      day: saisie.day,
    };
    const s = store.getState();
    const resultat =
      fiche.id === null
        ? (await s.ajouterCharge(charge)).refusal
        : await s.modifierCharge(fiche.id, charge);
    setEnvoi(false);
    if (resultat === null) onFermer(true);
    else setRefus(true);
  };

  const arreter = async () => {
    if (fiche.id === null || envoi) return;
    setEnvoi(true);
    const resultat = await store.getState().arreterCharge(fiche.id);
    setEnvoi(false);
    if (resultat === null) onFermer(true);
    else setRefus(true);
  };

  return (
    <View
      style={{
        gap: 12,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.texte,
      }}
    >
      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', color: c.texte }}>
        {fiche.id === null ? r.charges.nouvelle : r.charges.modifier}
      </Text>
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.texte, fontWeight: '600' }}>{r.charges.libelle}</Text>
        <TextInput
          accessibilityLabel={r.charges.libelle}
          value={fiche.libelle}
          onChangeText={(t) => maj({ libelle: t })}
          maxLength={40}
          placeholder={r.charges.libelleExemple}
          placeholderTextColor={c.texteDiscret}
          style={{
            minHeight: theme.zoneTactileMin,
            fontSize: 17,
            color: c.texte,
            borderBottomWidth: 2,
            borderColor: c.texte,
          }}
        />
      </View>
      <ChampMontant
        nom={r.charges.montant}
        valeur={fiche.montant}
        onChange={(t) => maj({ montant: t })}
      />
      <Text style={{ color: c.texte, fontWeight: '600' }}>{r.charges.frequence}</Text>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
      >
        {(['monthly', 'weekly'] as const).map((f) => {
          const choisi = fiche.frequence === f;
          const titre = f === 'monthly' ? r.charges.mensuelle : r.charges.hebdomadaire;
          return (
            <Pressable
              key={f}
              accessibilityRole="radio"
              accessibilityLabel={titre}
              accessibilityState={{ checked: choisi }}
              onPress={() => maj({ frequence: f, jour: decalerJourCharge(f, fiche.jour, 0) })}
              style={{
                ...styleBouton,
                borderWidth: choisi ? 2 : 1,
                borderColor: c.texte,
                backgroundColor: choisi ? c.discret : 'transparent',
              }}
            >
              <Text style={{ color: c.texte, fontWeight: choisi ? '600' : 'normal' }}>{titre}</Text>
            </Pressable>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={r.charges.jourPrecedent}
          onPress={() => decaler(-1)}
          style={styleBoutonSecondaire}
        >
          <Text style={{ color: c.texte }}>−</Text>
        </Pressable>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={r.charges.jourLibelle(echeance)}
          accessibilityHint={r.charges.jourIndice}
          accessibilityActions={ACTIONS_JOUR}
          onAccessibilityAction={action}
          style={{ flexShrink: 1 }}
        >
          <Text style={{ color: c.texte, fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
            {echeance}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={r.charges.jourSuivant}
          onPress={() => decaler(1)}
          style={styleBoutonSecondaire}
        >
          <Text style={{ color: c.texte }}>+</Text>
        </Pressable>
      </View>
      {fiche.frequence === 'monthly' && fiche.jour > 28 && (
        <Texte discret>{r.charges.finDeMois}</Texte>
      )}
      {refus && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
          {r.charges.refus}
        </Text>
      )}
      <Bouton
        titre={r.charges.enregistrer}
        libelle={r.charges.enregistrerLibelle}
        principal
        inactif={!valide || envoi}
        onPress={() => void enregistrer()}
      />
      <Bouton
        titre={r.charges.annuler}
        libelle={r.charges.annulerLibelle}
        onPress={() => onFermer(false)}
      />
      {fiche.id !== null && (
        <>
          <Texte discret>{r.charges.arreterAide}</Texte>
          <Bouton
            titre={r.charges.arreter}
            libelle={r.charges.arreterLibelle(fiche.libelle)}
            inactif={envoi}
            onPress={() => void arreter()}
          />
        </>
      )}
    </View>
  );
}

function SectionRappel({
  store,
  onOuvrirReglagesTelephone,
}: {
  store: KakeiboStore;
  onOuvrirReglagesTelephone: () => void;
}) {
  const reglages = useStore(store, (s) => s.reglagesRappel);
  const heure = reglages?.reminderTime ?? HEURE_RAPPEL_DEFAUT;
  const active = reglages?.reminderEnabled ?? true;
  const [autorise, setAutorise] = useState(null as boolean | null);

  // À l'ouverture, et au retour des réglages du téléphone : l'autorisation a pu changer.
  const lireAutorisation = useCallback(() => {
    store
      .getState()
      .autorisationRappel()
      .then(setAutorise)
      .catch(() => setAutorise(null));
  }, [store]);
  useEffect(() => {
    lireAutorisation();
    const abonnement = AppState.addEventListener('change', (e) => {
      if (e === 'active') lireAutorisation();
    });
    return () => abonnement.remove();
  }, [lireAutorisation]);

  const regler = (reminderTime: string, reminderEnabled: boolean) => {
    void store.getState().reglerRappel({ reminderTime, reminderEnabled });
  };

  return (
    <Section titre={r.rappel.titre}>
      <Texte>{r.rappel.texte}</Texte>
      <View
        style={{
          minHeight: theme.zoneTactileMin,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text style={{ color: c.texte, fontSize: 17 }}>{r.rappel.active}</Text>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={r.rappel.activeLibelle}
          value={active}
          onValueChange={(v) => regler(heure, v)}
        />
      </View>
      {active && <ReglageHeure heure={heure} onChange={(h) => regler(h, active)} />}
      {active && autorise === false && (
        <>
          <Texte>{r.rappel.refuse}</Texte>
          <Bouton titre={r.rappel.ouvrirReglages} onPress={onOuvrirReglagesTelephone} />
        </>
      )}
    </Section>
  );
}

function SectionDonnees({ store, onEfface }: { store: KakeiboStore; onEfface: () => void }) {
  // 0 : rien demandé ; 1 : première confirmation ; 2 : dernière confirmation.
  const [etape, setEtape] = useState(0 as 0 | 1 | 2);
  const [envoi, setEnvoi] = useState(false);

  const effacer = async () => {
    if (envoi) return;
    setEnvoi(true);
    await store.getState().toutEffacer();
    setEnvoi(false);
    onEfface();
  };

  const annuler = (
    <Bouton
      titre={r.donnees.annuler}
      libelle={r.donnees.annulerLibelle}
      onPress={() => setEtape(0)}
    />
  );

  return (
    <Section titre={r.donnees.titre}>
      <Texte>{r.donnees.texte}</Texte>
      {etape === 0 && (
        <Bouton
          titre={r.donnees.effacer}
          libelle={r.donnees.effacerLibelle}
          onPress={() => setEtape(1)}
        />
      )}
      {etape === 1 && (
        <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
          <Texte>{r.donnees.confirmation1}</Texte>
          <Bouton
            titre={r.donnees.continuer}
            libelle={r.donnees.continuerLibelle}
            onPress={() => setEtape(2)}
          />
          {annuler}
        </View>
      )}
      {etape === 2 && (
        <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
          <Texte>{r.donnees.confirmation2}</Texte>
          <Bouton
            titre={r.donnees.confirmer}
            libelle={r.donnees.confirmerLibelle}
            principal
            inactif={envoi}
            onPress={() => void effacer()}
          />
          {annuler}
        </View>
      )}
    </Section>
  );
}

function SectionAPropos({ onComprendre }: { onComprendre: () => void }) {
  const a = r.aPropos;
  return (
    <Section titre={a.titre}>
      <Texte>{a.methode}</Texte>
      <Bouton titre={a.comprendre} libelle={a.comprendreLibelle} onPress={onComprendre} />
      <Text style={{ color: c.texte, fontWeight: '600' }}>{a.confidentialiteTitre}</Text>
      <Texte>{a.confidentialite}</Texte>
      <Text style={{ color: c.texte, fontWeight: '600' }}>{a.mentionsTitre}</Text>
      <Texte>{a.mentions}</Texte>
    </Section>
  );
}
