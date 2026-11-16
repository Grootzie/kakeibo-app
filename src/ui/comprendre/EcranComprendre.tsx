// Comprendre (E12, J5.7, #106) : tout ce qui a été expliqué une fois reste consultable. La liste
// des fiches, puis chaque fiche : la méthode, les quatre catégories, les quatre questions, les
// règles de la maison, le kintsugi, les gashapon, les fêtes de chaque mois (catalogue) et les
// objets de la maison, qui ouvrent leur fiche (J4.7). « En savoir plus » d'une carte de première
// fois l'ouvre directement à la bonne fiche. L'écran défile : rien ne se perd à 200 %. Ne parle
// qu'au store.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { catalogue } from '../../content/catalogue';
import { fr } from '../../i18n/fr';
import {
  FICHES_COMPRENDRE,
  type FicheComprendre,
  paragraphesDeFiche,
  vueFetes,
  vueObjetsObtenus,
} from '../../state/comprendre';
import type { KakeiboStore } from '../../state/store';
import { IconeCategorie } from '../depense/IconeCategorie';
import { type CategorieId, theme } from '../theme';

const c = theme.couleurs;
const k = fr.comprendre;
const ESPACE = 16;
const CATEGORIES: readonly CategorieId[] = ['essentiel', 'envies', 'culture', 'imprevus'];

export interface PropsEcranComprendre {
  store: KakeiboStore;
  /** Fiche ouverte d'emblée (« En savoir plus »), ou null pour la liste. */
  fiche: FicheComprendre | null;
  onRetour: () => void;
  /** Ouvre la fiche d'un objet de la maison (J4.7). */
  onOuvrirObjet: (itemId: string) => void;
}

const styleBouton = {
  minHeight: theme.zoneTactileMin,
  minWidth: theme.zoneTactileMin,
  justifyContent: 'center' as const,
};

const styleTexte = { fontSize: 16, lineHeight: 22, color: c.texte };
const styleSousTitre = { fontSize: 17, fontWeight: '600' as const, color: c.texte };

function Paragraphes({ fiche }: { fiche: FicheComprendre }) {
  return (
    <>
      {paragraphesDeFiche(fiche).map((texte) => (
        <Text key={texte} style={styleTexte}>
          {texte}
        </Text>
      ))}
    </>
  );
}

function Categories() {
  return (
    <View style={{ gap: 8 }}>
      {CATEGORIES.map((id) => (
        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconeCategorie categorie={id} couleur={theme.categories[id].couleur} />
          <Text style={{ ...styleTexte, flex: 1 }}>{fr.categories[id].nom}</Text>
        </View>
      ))}
    </View>
  );
}

function Fetes() {
  return (
    <View style={{ gap: ESPACE * 1.5 }}>
      {vueFetes(catalogue).map((f) => (
        <View key={f.mois} style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={styleSousTitre}>
            {k.piece(f.mois, f.piece)}
          </Text>
          <Text style={{ ...styleTexte, fontStyle: 'italic' }}>{f.fete}</Text>
          <Text style={styleTexte}>{f.explication}</Text>
        </View>
      ))}
    </View>
  );
}

function Objets({
  store,
  onOuvrirObjet,
}: {
  store: KakeiboStore;
  onOuvrirObjet: (itemId: string) => void;
}) {
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);
  const pieces = useMemo(() => {
    if (etat === null || maintenant === null) return [];
    return vueObjetsObtenus(etat, catalogue, maintenant);
  }, [etat, maintenant]);
  if (etat !== null && pieces.length === 0) {
    return <Text style={styleTexte}>{k.objetsVide}</Text>;
  }
  return (
    <View style={{ gap: ESPACE * 1.5 }}>
      {pieces.map((p) => (
        <View key={p.room} style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={styleSousTitre}>
            {k.piece(p.mois, p.piece)}
          </Text>
          {p.objets.map((o) => (
            <Pressable
              key={o.itemId}
              accessibilityRole="button"
              accessibilityLabel={k.objet(o.nom)}
              accessibilityHint={k.objetIndice}
              onPress={() => onOuvrirObjet(o.itemId)}
              style={styleBouton}
            >
              <Text style={{ ...styleTexte, textDecorationLine: 'underline' }}>
                {k.objet(o.nom)}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

export function EcranComprendre({ store, fiche, onRetour, onOuvrirObjet }: PropsEcranComprendre) {
  const [ouverte, setOuverte] = useState<FicheComprendre | null>(fiche);

  return (
    <SafeAreaView
      testID="ecran-comprendre"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView
        testID="ecran-comprendre-defilement"
        contentContainerStyle={{ padding: ESPACE, gap: ESPACE }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={k.retourLibelle}
            onPress={onRetour}
            style={styleBouton}
          >
            <Text style={{ color: c.texte }}>{k.retour}</Text>
          </Pressable>
          {ouverte !== null && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={k.toutesLesFichesLibelle}
              onPress={() => setOuverte(null)}
              style={styleBouton}
            >
              <Text style={{ color: c.texte }}>{k.toutesLesFiches}</Text>
            </Pressable>
          )}
        </View>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 20, fontWeight: '600', color: c.texte }}
        >
          {ouverte === null ? k.titre : k.fiches[ouverte]}
        </Text>

        {ouverte === null ? (
          <View style={{ gap: 8 }}>
            {FICHES_COMPRENDRE.map((f) => (
              <Pressable
                key={f}
                testID={`fiche-${f}`}
                accessibilityRole="button"
                accessibilityLabel={k.fiches[f]}
                accessibilityHint={k.ficheIndice}
                onPress={() => setOuverte(f)}
                style={{
                  ...styleBouton,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: c.discret,
                }}
              >
                <Text style={styleTexte}>{k.fiches[f]}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View testID={`fiche-ouverte-${ouverte}`} style={{ gap: ESPACE }}>
            <Paragraphes fiche={ouverte} />
            {ouverte === 'categories' && <Categories />}
            {ouverte === 'fetes' && <Fetes />}
            {ouverte === 'objets' && <Objets store={store} onOuvrirObjet={onOuvrirObjet} />}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
