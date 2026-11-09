// Accueil (E2) sans la maison, qui vient en J4. Composant d'affichage : la vue lui est passée.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  /** Ouvre « Clôturer ma journée » (E4). */
  onCloturer?: () => void;
  /** Ouvre « Rattraper un jour » (E5) : case « à rattraper » ou bandeau. */
  onRattraper?: (jour: string) => void;
  /** Ouvre le bilan de la semaine (E6) : une semaine ou le récapitulatif. */
  onBilanSemaine?: () => void;
  /** Ouvre le bilan du mois (E7). */
  onBilanMois?: () => void;
  /** Message « Annuler » après une dépense notée, sous l'enveloppe. */
  message?: ReactNode;
  /** Carte de première fois, sous le bandeau. */
  explication?: ReactNode;
  children?: ReactNode;
}

export function Accueil({
  vue,
  onAppuiLongDate,
  onNoterDepense,
  onCloturer,
  onRattraper,
  onBilanSemaine,
  onBilanMois,
  message,
  explication,
  children,
}: PropsAccueil) {
  // Zone sûre, comme E4 : sur Android l'appli est dessinée bord à bord, et sans elle la date
  // passait sous la barre d'état (l'appui long arrivait au système, #49).
  return (
    <SafeAreaView
      testID="accueil-zone-sure"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView
        testID="accueil"
        style={{ flex: 1, backgroundColor: c.fond }}
        contentContainerStyle={{ padding: ESPACE, gap: ESPACE }}
      >
        {vue && <EnTete jour={vue.jour} onAppuiLong={onAppuiLongDate} />}
        {vue?.bandeau && (
          <Bandeau
            bandeau={vue.bandeau}
            onRattraper={onRattraper}
            onBilanSemaine={onBilanSemaine}
            onBilanMois={onBilanMois}
          />
        )}
        {explication}
        {vue && <Enveloppe enveloppe={vue.enveloppe} />}
        {message}
        {vue && <CarteTampons cases={vue.cases} onRattraper={onRattraper} />}
        <Boutons
          aujourdhuiCloture={vue?.aujourdhuiCloture ?? false}
          onNoterDepense={onNoterDepense}
          onCloturer={onCloturer}
        />
        {children}
      </ScrollView>
    </SafeAreaView>
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
      {/* Appui long : réglage caché des builds de développement. Un Pressable, car l'appui long
          d'un simple Text dans le ScrollView ne se déclenche pas sur Android (#49). Il reste
          invisible au lecteur d'écran : la date y est annoncée comme titre. */}
      <Pressable
        testID="date-accueil"
        accessible={false}
        onLongPress={onAppuiLong}
        style={{ flexShrink: 1 }}
      >
        <Text
          accessibilityRole="header"
          style={{ fontSize: 20, fontWeight: '600', color: c.texte }}
        >
          {fr.accueil.date(jour)}
        </Text>
      </Pressable>
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

/** Texte et action du bandeau ; la résolution n'ouvre rien. */
function contenuBandeau(
  bandeau: BandeauAccueil,
  actions: {
    onRattraper?: (jour: string) => void;
    onBilanSemaine?: () => void;
    onBilanMois?: () => void;
  },
): { texte: string; onPress?: () => void } {
  switch (bandeau.type) {
    case 'bilan_semaine':
      return {
        texte:
          bandeau.ecran.kind === 'recap'
            ? fr.accueil.bandeauBilanSemaines
            : fr.accueil.bandeauBilanSemaine,
        onPress: actions.onBilanSemaine,
      };
    case 'bilan_mois':
      return { texte: fr.accueil.bandeauBilanMois(bandeau.mois), onPress: actions.onBilanMois };
    case 'jour_a_rattraper':
      return {
        texte: fr.accueil.bandeauRattraper(bandeau.jour),
        onPress: () => actions.onRattraper?.(bandeau.jour),
      };
    case 'resolution':
      return { texte: fr.accueil.bandeauResolution(bandeau.resolution) };
  }
}

/**
 * Un seul bandeau, par priorité : bilan de la semaine (E6), bilan du mois (E7), jour à
 * rattraper (E5, le plus ancien), résolution du mois. C'est un bouton qui ouvre son écran.
 */
function Bandeau({
  bandeau,
  ...actions
}: {
  bandeau: BandeauAccueil;
  onRattraper?: (jour: string) => void;
  onBilanSemaine?: () => void;
  onBilanMois?: () => void;
}) {
  const { texte, onPress } = contenuBandeau(bandeau, actions);
  const style = {
    minHeight: theme.zoneTactileMin,
    justifyContent: 'center' as const,
    backgroundColor: c.discret,
    borderRadius: 8,
    padding: 12,
  };
  if (bandeau.type === 'resolution') {
    // Résolution du mois : un rappel à lire, rien à ouvrir.
    return (
      <View testID="bandeau" accessible accessibilityLabel={texte} style={style}>
        <Text style={{ color: c.texte }}>{texte}</Text>
      </View>
    );
  }
  return (
    <Pressable
      testID="bandeau"
      accessibilityRole="button"
      accessibilityLabel={texte}
      accessibilityLiveRegion="polite"
      onPress={onPress}
      style={style}
    >
      <Text style={{ color: c.texte }}>{texte}</Text>
    </Pressable>
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

/** Seules les cases « à rattraper » se touchent : elles ouvrent E5 sur leur jour. */
function CarteTampons({
  cases,
  onRattraper,
}: {
  cases: CaseTampon[];
  onRattraper?: (jour: string) => void;
}) {
  return (
    <View accessibilityLabel={fr.accueil.carteTampons} style={{ flexDirection: 'row', gap: 4 }}>
      {cases.map(({ jour, statut }) => {
        const forme = FORMES[statut];
        const commun = {
          testID: `case-${jour}`,
          accessible: true,
          accessibilityLabel: fr.accueil.caseLibelle(jour, statut),
          style: {
            flex: 1,
            minHeight: theme.zoneTactileMin,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            ...forme.cadre,
          } satisfies ViewStyle,
        } as const;
        const lettre = (
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
        );
        return statut === 'rattrapable' ? (
          <Pressable
            key={jour}
            {...commun}
            accessibilityRole="button"
            onPress={() => onRattraper?.(jour)}
          >
            {lettre}
          </Pressable>
        ) : (
          <View key={jour} {...commun}>
            {lettre}
          </View>
        );
      })}
    </View>
  );
}

function Boutons({
  aujourdhuiCloture,
  onNoterDepense,
  onCloturer,
}: {
  aujourdhuiCloture: boolean;
  onNoterDepense?: () => void;
  onCloturer?: () => void;
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
        onPress={onCloturer}
        style={{ ...bouton, borderWidth: 2, borderColor: c.principal, backgroundColor: c.fond }}
      >
        <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>{cloture}</Text>
      </Pressable>
    </View>
  );
}
