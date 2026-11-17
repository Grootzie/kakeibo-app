// Feuille « Noter une dépense » (E3). Composant d'affichage : les jours proposés et
// l'enregistrement lui sont passés ; les bornes viennent du domaine. Ouverte depuis le carnet
// avec une dépense (J5.4, #103), c'est la même feuille, pré-remplie, avec « Supprimer » et sa
// confirmation.
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addDays } from '../../domain/calendrier';
import { NOTE_MAX_LENGTH, isValidAmount } from '../../domain/depense';
import type { DayKey } from '../../domain/scellement';
import { fr } from '../../i18n/fr';
import { type CategorieId, theme } from '../theme';
import { IconeCategorie } from './IconeCategorie';
import { ecrireMontant, lireMontant } from './montant';

const c = theme.couleurs;
const ESPACE = 16;
const CATEGORIES: CategorieId[] = ['essentiel', 'envies', 'culture', 'imprevus'];

export interface DepenseSaisie {
  amount: number;
  category: CategorieId;
  note: string;
  day: DayKey;
}

export interface PropsFeuilleDepense {
  /** Jours proposés, du plus récent au plus ancien ; le premier est choisi par défaut. */
  jours: DayKey[];
  aujourdhui: DayKey;
  /** Jour choisi à l'ouverture (« Ajouter une dépense oubliée », E4) ; sinon le premier proposé. */
  jourInitial?: DayKey;
  /** Dépense à modifier (carnet, #103) : la feuille s'ouvre pré-remplie. */
  depense?: DepenseSaisie;
  /** Avec une dépense : « Supprimer », après confirmation. Rend false si c'est refusé. */
  onSupprimer?(): Promise<boolean>;
  /** Rend false si la dépense est refusée : la feuille reste ouverte. */
  onEnregistrer(depense: DepenseSaisie): Promise<boolean>;
  onFermer: () => void;
}

/** Coupe la note à 80 caractères (pas unités de code : un emoji compte pour un). */
const couper = (texte: string): string => Array.from(texte).slice(0, NOTE_MAX_LENGTH).join('');

export function FeuilleDepense({
  jours,
  aujourdhui,
  jourInitial,
  onEnregistrer,
  onFermer,
  depense,
  onSupprimer,
}: PropsFeuilleDepense) {
  const modification = depense !== undefined;
  const debut = depense?.day ?? jourInitial;
  const [texte, setTexte] = useState(depense === undefined ? '' : ecrireMontant(depense.amount));
  const [note, setNote] = useState(depense?.note ?? '');
  const [jour, setJour] = useState<DayKey>(
    debut !== undefined && jours.includes(debut) ? debut : (jours[0] ?? aujourdhui),
  );
  const [refuse, setRefuse] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [suppressionRefusee, setSuppressionRefusee] = useState(false);

  const centimes = lireMontant(texte);
  const valide = centimes !== null && isValidAmount(centimes);

  const enregistrer = async (category: CategorieId) => {
    if (!valide || envoi) return;
    setEnvoi(true);
    const ok = await onEnregistrer({ amount: centimes, category, note, day: jour });
    setEnvoi(false);
    if (ok) onFermer();
    else setRefuse(true);
  };

  const supprimer = async () => {
    if (onSupprimer === undefined || envoi) return;
    setEnvoi(true);
    const ok = await onSupprimer();
    setEnvoi(false);
    if (ok) onFermer();
    else {
      setConfirmer(false);
      setSuppressionRefusee(true);
    }
  };

  return (
    <Modal
      testID="feuille-depense"
      visible
      transparent
      animationType="slide"
      onRequestClose={onFermer}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.voile }}
      >
        {/* Bord à bord sur Android : la feuille ne passe pas sous la barre de navigation. */}
        <SafeAreaView
          testID="feuille-depense-contenu"
          edges={['bottom']}
          accessibilityViewIsModal
          style={{
            backgroundColor: c.fond,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '100%',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: ESPACE, gap: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                accessibilityRole="header"
                style={{ flex: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
              >
                {modification ? fr.depense.titreModifier : fr.depense.titre}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fr.depense.fermerLibelle}
                onPress={onFermer}
                style={{
                  minHeight: theme.zoneTactileMin,
                  minWidth: theme.zoneTactileMin,
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                }}
              >
                <Text style={{ color: c.texte }}>{fr.depense.fermer}</Text>
              </Pressable>
            </View>

            <TextInput
              autoFocus
              keyboardType="decimal-pad"
              accessibilityLabel={fr.depense.montantLibelle}
              accessibilityHint={fr.depense.bornes}
              placeholder={fr.depense.montantExemple}
              placeholderTextColor={c.texteDiscret}
              value={texte}
              onChangeText={(t) => {
                setTexte(t);
                setRefuse(false);
              }}
              style={{
                minHeight: theme.zoneTactileMin,
                fontSize: 32,
                fontWeight: '600',
                color: c.texte,
                borderBottomWidth: 2,
                borderColor: c.texte,
              }}
            />
            <Text style={{ color: c.texteDiscret }}>{fr.depense.bornes}</Text>

            <View
              accessibilityLabel={fr.depense.categories}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
            >
              {CATEGORIES.map((id) => {
                const nom = fr.categories[id].nom;
                const inactif = !valide || envoi;
                const actuelle = depense?.category === id;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityLabel={
                      actuelle
                        ? fr.depense.categorieActuelleLibelle(nom)
                        : fr.depense.categorieLibelle(nom)
                    }
                    accessibilityState={{ disabled: inactif, selected: actuelle }}
                    disabled={inactif}
                    onPress={() => void enregistrer(id)}
                    style={{
                      flexBasis: '47%',
                      flexGrow: 1,
                      minHeight: 56,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: theme.categories[id].couleur,
                      borderWidth: actuelle ? 3 : 0,
                      borderColor: c.texte,
                      opacity: inactif ? 0.4 : 1,
                    }}
                  >
                    <IconeCategorie categorie={id} couleur={c.surPrincipal} />
                    <View
                      testID={`libelle-categorie-${id}`}
                      style={{
                        flexShrink: 1,
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'baseline',
                        columnGap: 6,
                      }}
                    >
                      <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
                        {nom}
                      </Text>
                      {actuelle && (
                        <Text style={{ color: c.surPrincipal, fontSize: 15 }}>
                          {fr.depense.categorieActuelle}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {modification && (
              <Text style={{ color: c.texteDiscret }}>{fr.depense.modifierConsigne}</Text>
            )}
            {refuse && (
              <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
                {modification ? fr.depense.refusModification : fr.depense.refus}
              </Text>
            )}

            <Text style={{ color: c.texteDiscret }}>{fr.depense.date}</Text>
            <ScrollView horizontal keyboardShouldPersistTaps="handled">
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
                {jours.map((j) => {
                  const choisi = j === jour;
                  return (
                    <Pressable
                      key={j}
                      accessibilityRole="radio"
                      accessibilityLabel={fr.depense.jourLibelle(j)}
                      accessibilityState={{ selected: choisi }}
                      onPress={() => {
                        setJour(j);
                        setRefuse(false);
                      }}
                      style={{
                        minHeight: theme.zoneTactileMin,
                        paddingHorizontal: 12,
                        borderRadius: 22,
                        justifyContent: 'center',
                        borderWidth: choisi ? 2 : 1,
                        borderColor: choisi ? c.principal : c.texteDiscret,
                        backgroundColor: choisi ? c.principal : c.fond,
                      }}
                    >
                      <Text style={{ color: choisi ? c.surPrincipal : c.texte, fontWeight: '600' }}>
                        {libelleJour(j, aujourdhui)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={{ color: c.texteDiscret }}>{fr.depense.note}</Text>
            <TextInput
              accessibilityLabel={fr.depense.noteLibelle}
              placeholder={fr.depense.noteExemple}
              placeholderTextColor={c.texteDiscret}
              value={note}
              onChangeText={(t) => setNote(couper(t))}
              style={{
                minHeight: theme.zoneTactileMin,
                fontSize: 17,
                color: c.texte,
                borderBottomWidth: 1,
                borderColor: c.texteDiscret,
              }}
            />
            <Text style={{ color: c.texteDiscret, alignSelf: 'flex-end' }}>
              {fr.depense.noteCompteur(Array.from(note).length)}
            </Text>

            {onSupprimer !== undefined && !confirmer && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fr.depense.supprimerLibelle}
                accessibilityState={{ disabled: envoi }}
                disabled={envoi}
                onPress={() => {
                  setConfirmer(true);
                  setSuppressionRefusee(false);
                }}
                style={styleBoutonSecondaire}
              >
                <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>
                  {fr.depense.supprimer}
                </Text>
              </Pressable>
            )}
            {suppressionRefusee && (
              <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
                {fr.depense.refusSuppression}
              </Text>
            )}
            {onSupprimer !== undefined && confirmer && (
              <View testID="confirmer-suppression" style={{ gap: 8 }}>
                <Text accessibilityLiveRegion="polite" style={{ color: c.texte, fontSize: 17 }}>
                  {fr.depense.confirmerSuppression}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={fr.depense.garderLibelle}
                    onPress={() => setConfirmer(false)}
                    style={{ ...styleBoutonSecondaire, flexGrow: 1 }}
                  >
                    <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>
                      {fr.depense.garder}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={fr.depense.confirmerSupprimerLibelle}
                    accessibilityState={{ disabled: envoi }}
                    disabled={envoi}
                    onPress={() => void supprimer()}
                    style={{
                      ...styleBoutonSecondaire,
                      flexGrow: 1,
                      borderColor: c.principal,
                      backgroundColor: c.principal,
                    }}
                  >
                    <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
                      {fr.depense.confirmerSupprimer}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styleBoutonSecondaire: ViewStyle = {
  minHeight: theme.zoneTactileMin,
  minWidth: theme.zoneTactileMin,
  paddingHorizontal: 16,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: c.texteDiscret,
  justifyContent: 'center',
  alignItems: 'center',
};

function libelleJour(jour: DayKey, aujourdhui: DayKey): string {
  if (jour === aujourdhui) return fr.depense.aujourdhui;
  if (jour === addDays(aujourdhui, -1)) return fr.depense.hier;
  return fr.depense.jourCourt(jour);
}
