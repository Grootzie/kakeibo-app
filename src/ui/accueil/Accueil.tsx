// Accueil (E2) sans la maison, qui vient en J4. Composant d'affichage : la vue lui est passée.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';

import { fr } from '../../i18n/fr';
import type {
  BandeauAccueil,
  CaseTampon,
  EnveloppeSemaine,
  StatutCase,
  VueAccueil,
} from '../../state/selecteurs';
import { theme } from '../theme';

const c = theme.couleurs;
const ESPACE = 16;

export interface PropsAccueil {
  /** Null tant que l'état n'est pas chargé : seuls les boutons s'affichent. */
  vue: VueAccueil | null;
  onAppuiLongDate?: () => void;
  /** Ouvre la feuille « Noter une dépense » (E3). */
  onNoterDepense?: () => void;
  /** Message « Annuler » après une dépense notée, sous l'enveloppe. */
  message?: ReactNode;
  children?: ReactNode;
}

export function Accueil({ vue, onAppuiLongDate, onNoterDepense, message, children }: PropsAccueil) {
  return (
    <ScrollView
      testID="accueil"
      style={{ flex: 1, backgroundColor: c.fond }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: ESPACE, gap: ESPACE }}
    >
      {vue && <EnTete jour={vue.jour} onAppuiLong={onAppuiLongDate} />}
      {vue?.bandeau && <Bandeau bandeau={vue.bandeau} />}
      {vue && <Enveloppe enveloppe={vue.enveloppe} />}
      {message}
      {vue && <CarteTampons cases={vue.cases} />}
      <Boutons
        aujourdhuiCloture={vue?.aujourdhuiCloture ?? false}
        onNoterDepense={onNoterDepense}
      />
      {children}
    </ScrollView>
  );
}

function EnTete({ jour, onAppuiLong }: { jour: string; onAppuiLong?: () => void }) {
  // Carnet (E9) et réglages (E10) viennent en J5 : présents, mais inactifs d'ici là.
  const acces = [
    { titre: fr.accueil.carnet, libelle: fr.accueil.carnetLibelle },
    { titre: fr.accueil.reglages, libelle: fr.accueil.reglagesLibelle },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        columnGap: 8,
      }}
    >
      <Text
        accessibilityRole="header"
        onLongPress={onAppuiLong}
        style={{ flexShrink: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
      >
        {fr.accueil.date(jour)}
      </Text>
      <View style={{ flexDirection: 'row', marginLeft: 'auto' }}>
        {acces.map(({ titre, libelle }) => (
          <Pressable
            key={titre}
            disabled
            accessibilityRole="button"
            accessibilityLabel={libelle}
            accessibilityState={{ disabled: true }}
            style={{
              minHeight: theme.zoneTactileMin,
              minWidth: theme.zoneTactileMin,
              paddingHorizontal: 6,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.texteDiscret }}>{titre}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Bandeau({ bandeau }: { bandeau: BandeauAccueil }) {
  return (
    <View
      testID="bandeau"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: c.discret, borderRadius: 8, padding: 12 }}
    >
      <Text style={{ color: c.texte }}>{fr.accueil.bandeauRattraper(bandeau.jour)}</Text>
    </View>
  );
}

function Enveloppe({ enveloppe }: { enveloppe: EnveloppeSemaine }) {
  const { reste, depense } = enveloppe;
  const total = enveloppe.enveloppe;
  const message = reste >= 0 ? fr.accueil.reste(reste, 'dimanche') : fr.accueil.depassement(-reste);
  const part = total > 0 ? Math.min(1, depense / total) : depense > 0 ? 1 : 0;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 22, fontWeight: '600', color: c.texte }}>{message}</Text>
      <Text style={{ color: c.texteDiscret }}>{fr.accueil.budgetSemaine(total)}</Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={fr.accueil.jaugeLibelle(depense, total)}
        accessibilityValue={{ min: 0, max: total, now: depense }}
        style={{ height: 12, borderRadius: 6, backgroundColor: c.jaugeFond, overflow: 'hidden' }}
      >
        <View
          testID="jauge-remplie"
          style={{ height: 12, width: `${Math.round(part * 100)}%`, backgroundColor: c.jauge }}
        />
      </View>
    </View>
  );
}

/** Chaque état a sa forme (bord, remplissage, lettre barrée) : la couleur ne porte rien seule. */
const FORMES: Record<StatutCase, { cadre: ViewStyle; lettre: string; barree: boolean }> = {
  cloturee: {
    cadre: {
      borderStyle: 'solid',
      borderWidth: 2,
      borderColor: c.principal,
      backgroundColor: c.principal,
    },
    lettre: c.surPrincipal,
    barree: false,
  },
  a_cloturer: {
    cadre: { borderStyle: 'solid', borderWidth: 3, borderColor: c.texte, backgroundColor: c.fond },
    lettre: c.texte,
    barree: false,
  },
  rattrapable: {
    cadre: { borderStyle: 'dashed', borderWidth: 2, borderColor: c.texte, backgroundColor: c.fond },
    lettre: c.texte,
    barree: false,
  },
  hors_decompte: {
    cadre: {
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: c.discret,
      backgroundColor: c.discret,
    },
    lettre: c.texteDiscret,
    barree: true,
  },
  a_venir: {
    cadre: {
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: c.texteDiscret,
      backgroundColor: c.fond,
    },
    lettre: c.texteDiscret,
    barree: false,
  },
};

function CarteTampons({ cases }: { cases: CaseTampon[] }) {
  return (
    <View accessibilityLabel={fr.accueil.carteTampons} style={{ flexDirection: 'row', gap: 4 }}>
      {cases.map(({ jour, statut }) => {
        const forme = FORMES[statut];
        return (
          <View
            key={jour}
            testID={`case-${jour}`}
            accessible
            accessibilityLabel={fr.accueil.caseLibelle(jour, statut)}
            style={{
              flex: 1,
              minHeight: theme.zoneTactileMin,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              ...forme.cadre,
            }}
          >
            <Text
              testID={`case-lettre-${jour}`}
              style={{
                color: forme.lettre,
                fontWeight: '600',
                textDecorationLine: forme.barree ? 'line-through' : 'none',
              }}
            >
              {fr.accueil.initiale(jour)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Boutons({
  aujourdhuiCloture,
  onNoterDepense,
}: {
  aujourdhuiCloture: boolean;
  onNoterDepense?: () => void;
}) {
  const bouton: ViewStyle = {
    minHeight: theme.zoneTactileMin,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: ESPACE,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const cloture = aujourdhuiCloture ? fr.accueil.journeeCloturee : fr.accueil.cloturerJournee;
  return (
    <View style={{ gap: 12 }}>
      {/* Clôturer (E4) s'ouvrira avec J2.4. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fr.accueil.noterDepenseLibelle}
        onPress={onNoterDepense}
        style={{ ...bouton, backgroundColor: c.principal }}
      >
        <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
          {fr.accueil.noterDepense}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cloture}
        disabled={aujourdhuiCloture}
        accessibilityState={{ disabled: aujourdhuiCloture }}
        style={{ ...bouton, borderWidth: 2, borderColor: c.principal, backgroundColor: c.fond }}
      >
        <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>{cloture}</Text>
      </Pressable>
    </View>
  );
}
