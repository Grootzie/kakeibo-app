// Fiche d'objet (E8, J4.7, #86) : toucher un objet de la maison l'ouvre. L'objet en grand sur
// fond de papier, dans son état ; son nom en français et en japonais (écriture et transcription) ;
// ce qu'il représente au Japon (explication du catalogue) ; son histoire dans la maison, tirée de
// `owned_item`. L'écran défile : rien ne se perd à 200 %. Ne parle qu'au store.
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { catalogue } from '../../content/catalogue';
import { fr } from '../../i18n/fr';
import type { Reparation } from '../../state/ecranMaison';
import { type VueFicheObjet, vueFicheObjet } from '../../state/ficheObjet';
import type { KakeiboStore } from '../../state/store';
import { theme } from '../theme';
import { ObjetEnGrand } from './ObjetEnGrand';

const c = theme.couleurs;
const f = fr.ficheObjet;
const m = fr.ecranMaison;
const ESPACE = 16;
/** Côté de l'objet dessiné en grand, en points. */
const TAILLE_OBJET = 220;

export interface PropsEcranFicheObjet {
  store: KakeiboStore;
  itemId: string | undefined;
  onRetour: () => void;
}

function etatVisible(fiche: VueFicheObjet, reparation: Reparation): string {
  if (fiche.etat === 'intact') return m.intact(fiche.nom);
  if (fiche.etat === 'repaired') return m.repare(fiche.nom);
  return reparation?.type === 'enCours'
    ? m.reparation(reparation.jours)
    : m.reparationEnAttente(fiche.nom);
}

function Section({ titre, texte }: { titre: string; texte: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', color: c.texte }}>
        {titre}
      </Text>
      <Text style={{ fontSize: 16, lineHeight: 22, color: c.texte }}>{texte}</Text>
    </View>
  );
}

export function EcranFicheObjet({ store, itemId, onRetour }: PropsEcranFicheObjet) {
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);
  const fiche = useMemo(() => {
    if (etat === null || maintenant === null || itemId === undefined) return null;
    return vueFicheObjet(etat, catalogue, itemId, maintenant);
  }, [etat, maintenant, itemId]);

  return (
    <SafeAreaView
      testID="fiche-objet"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: ESPACE }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={f.retourLibelle}
          onPress={onRetour}
          style={{
            minHeight: theme.zoneTactileMin,
            minWidth: theme.zoneTactileMin,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.texte }}>{f.retour}</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
        >
          {fiche === null ? m.titre : f.titre(fiche.nom)}
        </Text>
      </View>
      {fiche !== null && (
        <ScrollView
          testID="fiche-objet-defilement"
          contentContainerStyle={{ padding: ESPACE, paddingTop: 0, gap: ESPACE }}
        >
          <View
            testID="fiche-objet-papier"
            style={{
              backgroundColor: c.papier,
              borderRadius: 12,
              padding: ESPACE,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ObjetEnGrand
              visuels={fiche.visuels}
              etat={fiche.etat}
              taille={TAILLE_OBJET}
              libelle={m.objetLibelle(fiche.nom, fiche.etat, fiche.reparation)}
            />
            <View
              accessible
              accessibilityLabel={f.japonaisLibelle(fiche.japonais)}
              style={{ alignItems: 'center' }}
            >
              <Text style={{ fontSize: 28, color: c.texte }}>{fiche.japonais.kanji}</Text>
              <Text style={{ fontSize: 16, fontStyle: 'italic', color: c.texteDiscret }}>
                {fiche.japonais.romaji}
              </Text>
            </View>
            <Text style={{ fontSize: 15, color: c.texteDiscret, textAlign: 'center' }}>
              {etatVisible(fiche, fiche.reparation)}
            </Text>
          </View>
          <Section titre={f.auJapon} texte={fiche.explication} />
          <Section titre={f.sonHistoire} texte={f.histoire(fiche.nom, fiche.histoire)} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
