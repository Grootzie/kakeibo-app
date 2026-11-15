// Album des années passées (E8, J4.8, #87) : une vignette par maison passée ; toucher une
// vignette montre chacune de ses pièces en grand, telle qu'elle était à la fin de son année
// (objets encore fêlés compris, sans poussière ni réparation en cours). Album vide : un message
// court, sans reproche. Ne parle qu'au store ; la maison est dessinée par le seul composant de
// rendu (J4.4).
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { type Catalog, houseYear } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { type MaisonAlbum, vueAlbum } from '../../state/maison';
import type { KakeiboStore } from '../../state/store';
import { Maison } from '../maison/Maison';
import { theme } from '../theme';

const c = theme.couleurs;
const a = fr.album;
const ESPACE = 16;
const LARGEUR_VIGNETTE = 160;

export interface PropsEcranAlbum {
  store: KakeiboStore;
  /** Quitte l'album. */
  onRetour: () => void;
}

const styleRetour = {
  minHeight: theme.zoneTactileMin,
  minWidth: theme.zoneTactileMin,
  justifyContent: 'center' as const,
};

/** Une maison passée : la dernière pièce débloquée de l'année, en petit, et son année. */
function Vignette({ maison, onOuvrir }: { maison: MaisonAlbum; onOuvrir: () => void }) {
  const derniere = maison.pieces[maison.pieces.length - 1];
  return (
    <Pressable
      testID={`vignette-${maison.annee}`}
      accessibilityRole="button"
      accessibilityLabel={a.vignetteLibelle(maison.annee, maison.pieces.length)}
      accessibilityHint={a.vignetteIndice}
      onPress={onOuvrir}
      style={{
        width: LARGEUR_VIGNETTE,
        minHeight: theme.zoneTactileMin,
        gap: 8,
        padding: 8,
        borderRadius: 8,
        backgroundColor: c.discret,
      }}
    >
      {/* Le libellé du bouton suffit : la scène n'est pas lue une seconde fois. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {derniere !== undefined && <Maison vue={derniere} />}
      </View>
      <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
        {a.vignette(maison.annee)}
      </Text>
    </Pressable>
  );
}

/** Nom de la pièce dans le catalogue : « Kura, la réserve ». */
function nomDePiece(catalogue: Catalog, piece: string): string {
  const trouvee = catalogue.rooms.find((r) => {
    return r.id === piece;
  });
  return trouvee?.name ?? piece;
}

/** Les pièces d'une année, chacune en grand, dans l'ordre des mois. */
function PiecesDeLAnnee({ maison, catalogue }: { maison: MaisonAlbum; catalogue: Catalog }) {
  return (
    <View style={{ gap: ESPACE * 1.5 }}>
      {maison.pieces.map((vue) => {
        const nom = nomDePiece(catalogue, vue.scene.room);
        return (
          <View key={vue.scene.room} style={{ gap: 8 }}>
            <Text
              accessibilityRole="header"
              style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}
            >
              {a.piece(vue.scene.month, nom)}
            </Text>
            <Maison vue={vue} />
          </View>
        );
      })}
    </View>
  );
}

export function EcranAlbum({ store, onRetour }: PropsEcranAlbum) {
  const etat = useStore(store, (s) => s.etat);
  const catalogue = useStore(store, (s) => s.catalogue);
  const maintenant = useStore(store, (s) => s.maintenant);
  const [annee, setAnnee] = useState(null as number | null);

  const album = useMemo(
    () => (etat === null || maintenant === null ? [] : vueAlbum(etat, catalogue, maintenant)),
    [etat, catalogue, maintenant],
  );
  const ouverte = album.find((m) => {
    return m.annee === annee;
  });

  return (
    <SafeAreaView
      testID="ecran-album"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView contentContainerStyle={{ padding: ESPACE, gap: ESPACE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {ouverte === undefined ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={a.retourLibelle}
              onPress={onRetour}
              style={styleRetour}
            >
              <Text style={{ color: c.texte }}>{a.retour}</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={a.toutesLesAnneesLibelle}
              onPress={() => setAnnee(null)}
              style={styleRetour}
            >
              <Text style={{ color: c.texte }}>{a.toutesLesAnnees}</Text>
            </Pressable>
          )}
          <Text
            accessibilityRole="header"
            style={{ flex: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
          >
            {ouverte === undefined ? a.titre : a.annee(ouverte.annee)}
          </Text>
        </View>

        {ouverte !== undefined ? (
          <PiecesDeLAnnee maison={ouverte} catalogue={catalogue} />
        ) : album.length === 0 ? (
          maintenant !== null && (
            <Text style={{ color: c.texte }}>{a.vide(houseYear(maintenant.day))}</Text>
          )
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACE }}>
            {album.map((m) => (
              <Vignette key={m.annee} maison={m} onOuvrir={() => setAnnee(m.annee)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
