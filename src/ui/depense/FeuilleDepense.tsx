// Feuille « Noter une dépense » (E3). Composant d'affichage : les jours proposés et
// l'enregistrement lui sont passés ; les bornes viennent du domaine.
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
} from 'react-native';

import { addDays } from '../../domain/calendrier';
import { NOTE_MAX_LENGTH, isValidAmount } from '../../domain/depense';
import type { DayKey } from '../../domain/scellement';
import { fr } from '../../i18n/fr';
import { type CategorieId, theme } from '../theme';
import { IconeCategorie } from './IconeCategorie';
import { lireMontant } from './montant';

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
  /** Rend false si la dépense est refusée : la feuille reste ouverte. */
  onEnregistrer(depense: DepenseSaisie): Promise<boolean>;
  onFermer: () => void;
}

/** Coupe la note à 80 caractères (pas unités de code : un emoji compte pour un). */
const couper = (texte: string): string => Array.from(texte).slice(0, NOTE_MAX_LENGTH).join('');

export function FeuilleDepense({
  jours,
  aujourdhui,
  onEnregistrer,
  onFermer,
}: PropsFeuilleDepense) {
  const [texte, setTexte] = useState('');
  const [note, setNote] = useState('');
  const [jour, setJour] = useState<DayKey>(jours[0] ?? aujourdhui);
  const [refuse, setRefuse] = useState(false);
  const [envoi, setEnvoi] = useState(false);

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
        <View
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
                {fr.depense.titre}
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
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityLabel={fr.depense.categorieLibelle(nom)}
                    accessibilityState={{ disabled: inactif }}
                    disabled={inactif}
                    onPress={() => void enregistrer(id)}
                    style={{
                      flexBasis: '47%',
                      flexGrow: 1,
                      minHeight: 56,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: theme.categories[id].couleur,
                      opacity: inactif ? 0.4 : 1,
                    }}
                  >
                    <IconeCategorie categorie={id} couleur={c.surPrincipal} />
                    <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
                      {nom}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {refuse && (
              <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
                {fr.depense.refus}
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function libelleJour(jour: DayKey, aujourdhui: DayKey): string {
  if (jour === aujourdhui) return fr.depense.aujourdhui;
  if (jour === addDays(aujourdhui, -1)) return fr.depense.hier;
  return fr.depense.jourCourt(jour);
}
