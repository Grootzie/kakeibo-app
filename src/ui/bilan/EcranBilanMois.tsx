// Bilan du mois (E7) : les trois premières questions chiffrées (Q3 par catégorie), l'épargne
// réelle, la quatrième en texte libre (140 caractères au plus), puis la validation, qui ouvre la
// pièce du mois suivant (et celles des mois sautés) quel que soit le résultat ; puis la
// confirmation du budget du nouveau mois, pré-rempli (J3.5), et la pièce qui s'ouvre.
// Ne parle qu'au store, qui seul appelle le domaine et les dépôts.
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { RESOLUTION_MAX_LENGTH } from '../../domain/bilanMois';
import type { MonthKey } from '../../domain/calendrier';
import { fr } from '../../i18n/fr';
import type { BudgetToConfirm } from '../../domain/traitement';
import { budgetAConfirmer, piecesOuvertesParBilan, vueBilanMois } from '../../state/selecteurs';
import type { KakeiboStore, MontantsBudget } from '../../state/store';
import { ecrireMontant, lireMontant } from '../depense/montant';
import { theme } from '../theme';

const c = theme.couleurs;
const ESPACE = 16;

export interface PropsEcranBilanMois {
  store: KakeiboStore;
  /** Retour à l'accueil. */
  onTerminer: () => void;
}

/** Coupe au plus à 140 caractères, un emoji comptant pour un, comme le domaine. */
const couper = (texte: string): string =>
  Array.from(texte).slice(0, RESOLUTION_MAX_LENGTH).join('');

interface BilanFait {
  mois: MonthKey;
  phrases: string[];
}

/** Bilan validé, budget du nouveau mois à confirmer. */
interface BudgetEnCours {
  mois: MonthKey;
  proposition: BudgetToConfirm;
}

const styleBouton = {
  minHeight: theme.zoneTactileMin,
  borderRadius: 8,
  paddingVertical: 12,
  paddingHorizontal: ESPACE,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: c.principal,
};

interface ConfirmerBudget {
  (montants: MontantsBudget): Promise<boolean>;
}

/** Un montant au pavé numérique de E3 (virgule ou point, deux décimales). */
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
      <Text style={{ color: c.texte }}>{nom}</Text>
      <TextInput
        keyboardType="decimal-pad"
        accessibilityLabel={fr.bilanMois.champLibelle(nom)}
        value={valeur}
        onChangeText={onChange}
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

/**
 * Confirmation du budget du nouveau mois : revenus, charges fixes (à la main en attendant les
 * dépenses récurrentes, J5) et épargne visée, pré-remplis. Confirmer sans rien changer n'ajoute
 * aucune version.
 */
function ConfirmationBudget({
  proposition,
  onConfirmer,
}: {
  proposition: BudgetToConfirm;
  /** Rend vrai si le budget est enregistré. */
  onConfirmer: ConfirmerBudget;
}) {
  const [revenus, setRevenus] = useState(ecrireMontant(proposition.income));
  const [charges, setCharges] = useState(ecrireMontant(proposition.fixedCosts));
  const [epargne, setEpargne] = useState(ecrireMontant(proposition.savingsGoal));
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState(false);

  const income = lireMontant(revenus);
  const fixedCosts = lireMontant(charges);
  const savingsGoal = lireMontant(epargne);
  const lisible = income !== null && fixedCosts !== null && savingsGoal !== null;
  const budget = lisible ? income - fixedCosts - savingsGoal : null;
  const inactif = budget === null || budget <= 0 || envoi;

  const changer = (set: (t: string) => void) => (t: string) => {
    set(t);
    setRefus(false);
  };

  const confirmer = async () => {
    if (inactif || !lisible) return;
    setEnvoi(true);
    const ok = await onConfirmer({ income, fixedCosts, savingsGoal });
    setEnvoi(false);
    if (!ok) setRefus(true);
  };

  return (
    <View style={{ gap: ESPACE }}>
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600', color: c.texte }}>
        {fr.bilanMois.budgetTitre(proposition.month)}
      </Text>
      <Text style={{ color: c.texte }}>{fr.bilanMois.budgetIntro}</Text>
      <ChampMontant nom={fr.bilanMois.revenus} valeur={revenus} onChange={changer(setRevenus)} />
      <ChampMontant
        nom={fr.bilanMois.chargesFixes}
        valeur={charges}
        onChange={changer(setCharges)}
      />
      <ChampMontant
        nom={fr.bilanMois.epargneVisee}
        valeur={epargne}
        onChange={changer(setEpargne)}
      />
      {budget !== null && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.texte, fontWeight: '600' }}>
          {fr.bilanMois.budgetDuMois(budget)}
        </Text>
      )}
      {budget !== null && budget <= 0 && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
          {fr.bilanMois.budgetNul}
        </Text>
      )}
      {refus && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
          {fr.bilanMois.refusBudget}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fr.bilanMois.confirmerBudget}
        disabled={inactif}
        accessibilityState={{ disabled: inactif }}
        onPress={() => void confirmer()}
        style={{ ...styleBouton, opacity: inactif ? 0.4 : 1 }}
      >
        <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
          {fr.bilanMois.confirmerBudget}
        </Text>
      </Pressable>
    </View>
  );
}

/** Une question et sa réponse, lues d'un seul tenant par le lecteur d'écran. */
function Ligne({ question, montant, fort }: { question: string; montant: number; fort?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={fr.bilanMois.ligne(question, montant)}
      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
    >
      <Text style={{ color: c.texte, fontWeight: fort ? '600' : '400', flexShrink: 1 }}>
        {question}
      </Text>
      <Text style={{ color: c.texte, fontWeight: '600' }}>{fr.bilanMois.montant(montant)}</Text>
    </View>
  );
}

export function EcranBilanMois({ store, onTerminer }: PropsEcranBilanMois) {
  const [fait, setFait] = useState<BilanFait | null>(null);
  const [budget, setBudget] = useState<BudgetEnCours | null>(null);
  const etat = useStore(store, (s) => s.etat);
  const lignes = useStore(store, (s) => s.depenses);
  const catalogue = useStore(store, (s) => s.catalogue);
  const [resolution, setResolution] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState(false);

  const vue = useMemo(() => (etat ? vueBilanMois(etat, lignes) : null), [etat, lignes]);

  const valider = async () => {
    if (vue === null || envoi) return;
    setEnvoi(true);
    setRefus(false);
    let refusal: string | null;
    try {
      refusal = await store.getState().validerBilanMois(resolution);
    } catch {
      refusal = 'erreur';
    }
    setEnvoi(false);
    const { etat: apres, maintenant } = store.getState();
    if (refusal !== null || apres === null) {
      setRefus(true);
      return;
    }
    const proposition = maintenant === null ? null : budgetAConfirmer(apres, maintenant);
    if (proposition === null) {
      terminer(vue.mois);
      return;
    }
    AccessibilityInfo.announceForAccessibility(
      `${fr.bilanMois.enregistre(vue.mois)} ${fr.bilanMois.budgetTitre(proposition.month)}`,
    );
    setBudget({ mois: vue.mois, proposition });
  };

  /** Le bilan est fait : la pièce du mois suivant (et des mois sautés) s'ouvre. */
  const terminer = (mois: MonthKey) => {
    const apres = store.getState().etat;
    const phrases = (apres === null ? [] : piecesOuvertesParBilan(apres, mois, catalogue)).map(
      (p) => fr.messages.nouvellePiece(p.mois, p.fete),
    );
    AccessibilityInfo.announceForAccessibility(
      [fr.bilanMois.enregistre(mois), ...phrases].join(' '),
    );
    setBudget(null);
    setFait({ mois, phrases });
  };

  const confirmerBudget: ConfirmerBudget = async (montants) => {
    if (budget === null) return false;
    let refusal: string | null;
    try {
      refusal = await store.getState().confirmerBudget(montants);
    } catch {
      refusal = 'erreur';
    }
    if (refusal !== null) return false;
    terminer(budget.mois);
    return true;
  };

  const moisAffiche = fait?.mois ?? budget?.mois ?? vue?.mois ?? null;
  const titre = moisAffiche === null ? fr.bilan.titreMoisSans : fr.bilan.titreMois(moisAffiche);
  const chiffres = vue?.chiffres ?? null;
  const nb = Array.from(resolution).length;

  return (
    <SafeAreaView
      testID="ecran-bilan-mois"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: ESPACE, gap: ESPACE }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fr.bilan.retourLibelle}
            onPress={onTerminer}
            style={{
              minHeight: theme.zoneTactileMin,
              minWidth: theme.zoneTactileMin,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.texte }}>{fr.bilan.retour}</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{ flex: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
          >
            {titre}
          </Text>
        </View>

        {fait !== null && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: c.texte, fontWeight: '600' }}>
              {fr.bilanMois.enregistre(fait.mois)}
            </Text>
            {fait.phrases.map((p) => (
              <Text key={p} style={{ color: c.texte }}>
                {p}
              </Text>
            ))}
          </View>
        )}

        {budget !== null && (
          <>
            <Text style={{ color: c.texte, fontWeight: '600' }}>
              {fr.bilanMois.enregistre(budget.mois)}
            </Text>
            <ConfirmationBudget proposition={budget.proposition} onConfirmer={confirmerBudget} />
          </>
        )}

        {fait === null && budget === null && vue === null && (
          <Text style={{ color: c.texteDiscret }}>{fr.bilanMois.rienAFaire}</Text>
        )}

        {fait === null && budget === null && vue !== null && (
          <>
            <View style={{ gap: 8 }}>
              {chiffres === null ? (
                <Text style={{ color: c.texteDiscret }}>{fr.bilanMois.sansBudget}</Text>
              ) : (
                <>
                  <Ligne question={fr.bilanMois.q1} montant={chiffres.q1} />
                  <Ligne question={fr.bilanMois.q2} montant={chiffres.q2} />
                </>
              )}
              <Ligne
                question={fr.bilanMois.q3}
                montant={chiffres?.q3 ?? vue.parCategorie.reduce((t, x) => t + x.total, 0)}
              />
              <View style={{ gap: 4, paddingLeft: ESPACE }}>
                {vue.parCategorie.length === 0 ? (
                  <Text style={{ color: c.texteDiscret }}>{fr.bilanMois.aucuneDepense}</Text>
                ) : (
                  vue.parCategorie.map((t) => (
                    <View
                      key={t.categorie}
                      accessible
                      accessibilityLabel={fr.bilanMois.ligne(
                        fr.categories[t.categorie].nom,
                        t.total,
                      )}
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
                      <Text style={{ color: c.texte, flex: 1 }}>
                        {fr.categories[t.categorie].nom}
                      </Text>
                      <Text style={{ color: c.texte }}>{fr.bilanMois.montant(t.total)}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {chiffres !== null && (
              <View style={{ gap: 8 }}>
                <Ligne question={fr.bilanMois.epargne} montant={chiffres.realSavings} fort />
                <Text style={{ color: c.texte }}>
                  {chiffres.goalReached
                    ? fr.bilanMois.objectifAtteint
                    : fr.bilanMois.objectifManque}
                </Text>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Text accessibilityRole="header" style={{ fontWeight: '600', color: c.texte }}>
                {fr.bilanMois.q4}
              </Text>
              <TextInput
                accessibilityLabel={fr.bilanMois.q4Libelle}
                placeholder={fr.bilanMois.q4Exemple}
                placeholderTextColor={c.texteDiscret}
                multiline
                value={resolution}
                onChangeText={(t) => setResolution(couper(t))}
                style={{
                  minHeight: theme.zoneTactileMin * 2,
                  fontSize: 17,
                  color: c.texte,
                  borderWidth: 1,
                  borderRadius: 8,
                  borderColor: c.texteDiscret,
                  padding: 8,
                  textAlignVertical: 'top',
                }}
              />
              <Text style={{ color: c.texteDiscret, alignSelf: 'flex-end' }}>
                {fr.bilanMois.compteur(nb)}
              </Text>
            </View>

            {refus && (
              <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
                {fr.bilanMois.refus}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={fr.bilanMois.valider}
              disabled={envoi}
              accessibilityState={{ disabled: envoi }}
              onPress={() => void valider()}
              style={styleBouton}
            >
              <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
                {fr.bilanMois.valider}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
