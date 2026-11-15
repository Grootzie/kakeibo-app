// La maison (E8, J4.6, #85) : les pièces débloquées de l'année, chacune dessinée par le seul
// composant de rendu (J4.4), puis ses objets, chacun avec son état : intact, réparé à l'or, ou
// fêlé avec « Réparation : 4 jours sur 7 » pour l'objet en tête de la file (valeur du modèle de
// scène) et sans chiffre pour ceux qui attendent leur tour. Les emplacements libres sont dits
// discrètement sous la liste. Toucher un objet, sur le dessin ou dans la liste, ouvre sa fiche
// (J4.7) ; un bouton ouvre l'album (J4.8). Ne parle qu'au store.
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import type { Catalog, ItemId } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import {
  type ObjetDeLaMaison,
  type PieceDeLaMaison,
  vueEcranMaison,
} from '../../state/ecranMaison';
import type { KakeiboStore } from '../../state/store';
import { theme } from '../theme';
import { Maison } from './Maison';
import { ZonesObjets } from './ZonesObjets';

const c = theme.couleurs;
const m = fr.ecranMaison;
const ESPACE = 16;

export interface PropsEcranMaison {
  store: KakeiboStore;
  onRetour: () => void;
  /** Ouvre la fiche d'un objet (J4.7). */
  onOuvrirObjet: (itemId: ItemId) => void;
  onOuvrirAlbum: () => void;
}

const styleBoutonTexte = {
  minHeight: theme.zoneTactileMin,
  minWidth: theme.zoneTactileMin,
  justifyContent: 'center' as const,
};

function etatVisible(objet: ObjetDeLaMaison): string {
  if (objet.etat === 'intact') return m.intact(objet.nom);
  if (objet.etat === 'repaired') return m.repare(objet.nom);
  return objet.reparation?.type === 'enCours'
    ? m.reparation(objet.reparation.jours)
    : m.reparationEnAttente(objet.nom);
}

function LigneObjet({ objet, onOuvrir }: { objet: ObjetDeLaMaison; onOuvrir: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m.objetLibelle(objet.nom, objet.etat, objet.reparation)}
      accessibilityHint={m.objetIndice}
      onPress={onOuvrir}
      style={{
        minHeight: theme.zoneTactileMin,
        justifyContent: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: c.jaugeFond,
      }}
    >
      <Text style={{ color: c.texte, fontSize: 17 }}>{m.nomObjet(objet.nom)}</Text>
      <Text style={{ color: objet.etat === 'repaired' ? c.or : c.texteDiscret, fontSize: 15 }}>
        {etatVisible(objet)}
      </Text>
    </Pressable>
  );
}

function nomDePiece(catalogue: Catalog, piece: string): string {
  return catalogue.rooms.find((r) => r.id === piece)?.name ?? piece;
}

function Piece({
  piece,
  catalogue,
  onOuvrirObjet,
}: {
  piece: PieceDeLaMaison;
  catalogue: Catalog;
  onOuvrirObjet: (itemId: ItemId) => void;
}) {
  const { scene } = piece.vue;
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>
        {m.piece(scene.month, nomDePiece(catalogue, scene.room))}
      </Text>
      <View>
        <Maison vue={piece.vue} />
        <ZonesObjets scene={scene} onToucher={onOuvrirObjet} />
      </View>
      <View>
        {piece.objets.map((objet) => (
          <LigneObjet
            key={objet.itemId}
            objet={objet}
            onOuvrir={() => onOuvrirObjet(objet.itemId)}
          />
        ))}
      </View>
      {piece.libres > 0 && (
        <Text style={{ color: c.texteDiscret, fontSize: 15 }}>{m.libres(piece.libres)}</Text>
      )}
    </View>
  );
}

export function EcranMaison({ store, onRetour, onOuvrirObjet, onOuvrirAlbum }: PropsEcranMaison) {
  const etat = useStore(store, (s) => s.etat);
  const catalogue = useStore(store, (s) => s.catalogue);
  const maintenant = useStore(store, (s) => s.maintenant);
  const vue = useMemo(() => {
    if (etat === null || maintenant === null) return null;
    return vueEcranMaison(etat, catalogue, maintenant);
  }, [etat, catalogue, maintenant]);

  return (
    <SafeAreaView
      testID="ecran-maison"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView
        testID="ecran-maison-defilement"
        contentContainerStyle={{ padding: ESPACE, gap: ESPACE * 1.5 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={m.retourLibelle}
            onPress={onRetour}
            style={styleBoutonTexte}
          >
            <Text style={{ color: c.texte }}>{m.retour}</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{ flex: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
          >
            {m.titre}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={m.albumLibelle}
            onPress={onOuvrirAlbum}
            style={styleBoutonTexte}
          >
            <Text style={{ color: c.texte, textDecorationLine: 'underline' }}>{m.album}</Text>
          </Pressable>
        </View>

        {vue?.pieces.map((piece) => (
          <Piece
            key={piece.vue.scene.room}
            piece={piece}
            catalogue={catalogue}
            onOuvrirObjet={onOuvrirObjet}
          />
        ))}

        {vue !== null && vue.enAttente.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text
              accessibilityRole="header"
              style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}
            >
              {m.enAttenteTitre}
            </Text>
            {vue.enAttente.map((o) => (
              <View key={o.itemId} style={{ gap: 4 }}>
                <Text style={{ color: c.texte, fontSize: 17 }}>{m.nomObjet(o.nom)}</Text>
                <Text style={{ color: c.texteDiscret, fontSize: 15 }}>
                  {fr.messages.objetEnAttente(o.moisPiece, o.moisBilan)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
