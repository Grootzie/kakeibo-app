// Bilan du mois (E7) : les trois premières questions chiffrées (Q3 par catégorie), l'épargne
// réelle, la quatrième en texte libre (140 caractères au plus), puis la validation, qui ouvre la
// pièce du mois suivant (et celles des mois sautés) quel que soit le résultat.
// La confirmation du budget du nouveau mois et la résolution sur l'accueil viennent avec J3.5.
// Ne parle qu'au store, qui seul appelle le domaine et les dépôts.
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { RESOLUTION_MAX_LENGTH } from '../../domain/bilanMois';
import type { MonthKey } from '../../domain/calendrier';
import { fr } from '../../i18n/fr';
import { piecesOuvertesParBilan, vueBilanMois } from '../../state/selecteurs';
import type { KakeiboStore } from '../../state/store';
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
    const apres = store.getState().etat;
    if (refusal !== null || apres === null) {
      setRefus(true);
      return;
    }
    const phrases = piecesOuvertesParBilan(apres, vue.mois, catalogue).map((p) =>
      fr.messages.nouvellePiece(p.mois, p.fete),
    );
    AccessibilityInfo.announceForAccessibility(
      [fr.bilanMois.enregistre(vue.mois), ...phrases].join(' '),
    );
    setFait({ mois: vue.mois, phrases });
  };

  const moisAffiche = fait?.mois ?? vue?.mois ?? null;
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

        {fait === null && vue === null && (
          <Text style={{ color: c.texteDiscret }}>{fr.bilanMois.rienAFaire}</Text>
        )}

        {fait === null && vue !== null && (
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
              style={{
                minHeight: theme.zoneTactileMin,
                borderRadius: 8,
                paddingVertical: 12,
                paddingHorizontal: ESPACE,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.principal,
              }}
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
