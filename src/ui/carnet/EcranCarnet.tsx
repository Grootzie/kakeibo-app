// Carnet (E9, J5.3, #102) : les dépenses passées par semaine, groupées par jour, avec les totaux
// par catégorie et un filtre par mois. Une semaine à cheval sur deux mois est coupée aux jours
// du mois affiché, et le dit (#102). Les semaines scellées affichent leur résultat figé
// (tampons, enveloppe et dépensé, dans l'enveloppe ou au-delà), sans ton de reproche. L'écran
// défile et les lignes passent à la ligne : rien ne se perd à 200 %. Ne parle qu'au store.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { fr } from '../../i18n/fr';
import {
  type DepenseCarnet,
  type JourCarnet,
  type SemaineCarnet,
  moisCourantDuCarnet,
  vueCarnet,
} from '../../state/carnet';
import type { KakeiboStore } from '../../state/store';
import { IconeCategorie } from '../depense/IconeCategorie';
import { theme } from '../theme';

const c = theme.couleurs;
const t = fr.carnet;
const ESPACE = 16;

export interface PropsEcranCarnet {
  store: KakeiboStore;
  /** Quitte le carnet. */
  onRetour: () => void;
}

const styleBouton: ViewStyle = {
  minHeight: theme.zoneTactileMin,
  minWidth: theme.zoneTactileMin,
  justifyContent: 'center',
  alignItems: 'center',
};

/** Une ligne qui passe à la ligne quand le texte grandit : libellé à gauche, montant à droite. */
const styleLigne: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 8,
};

function Filtre({
  mois,
  moisDisponibles,
  onChoisir,
}: {
  mois: string;
  moisDisponibles: string[];
  onChoisir: (mois: string) => void;
}) {
  const rang = moisDisponibles.indexOf(mois);
  const precedent = rang > 0 ? moisDisponibles[rang - 1] : null;
  const suivant = rang >= 0 && rang < moisDisponibles.length - 1 ? moisDisponibles[rang + 1] : null;
  const fleche = (texte: string, libelle: string, cible: string | null, id: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ disabled: cible === null }}
      disabled={cible === null}
      onPress={() => cible !== null && onChoisir(cible)}
      style={{ ...styleBouton, borderRadius: 8, backgroundColor: c.discret }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '600',
          color: cible === null ? c.texteDiscret : c.texte,
        }}
      >
        {texte}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ ...styleLigne, justifyContent: 'space-between' }}>
      {fleche(t.moisPrecedent, t.moisPrecedentLibelle(precedent), precedent, 'mois-precedent')}
      <Text
        testID="mois-carnet"
        accessibilityRole="header"
        accessibilityLabel={t.filtreLibelle(mois, rang + 1, moisDisponibles.length)}
        style={{ flexShrink: 1, fontSize: 20, fontWeight: '600', color: c.texte }}
      >
        {t.mois(mois)}
      </Text>
      {fleche(t.moisSuivant, t.moisSuivantLibelle(suivant), suivant, 'mois-suivant')}
    </View>
  );
}

function Resultat({ semaine }: { semaine: SemaineCarnet }) {
  const r = semaine.resultat;
  if (r === null) {
    return <Text style={{ color: c.texteDiscret }}>{t.semaineOuverte}</Text>;
  }
  const morceaux = [
    t.tampons(r.tampons, r.joursDecomptes),
    t.depense(r.depense, r.enveloppe),
    r.dansLeBudget ? t.dansEnveloppe : t.horsEnveloppe,
  ];
  return (
    <View
      testID={`resultat-${semaine.semaine}`}
      accessible
      accessibilityLabel={t.resultatLibelle(morceaux)}
      style={{ gap: 4, padding: 12, borderRadius: 8, backgroundColor: c.discret }}
    >
      {morceaux.map((m) => (
        <Text key={m} style={{ color: c.texte }}>
          {m}
        </Text>
      ))}
    </View>
  );
}

function Totaux({ semaine }: { semaine: SemaineCarnet }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: c.texte, fontWeight: '600' }}>{t.parCategorie}</Text>
      {semaine.totaux.map(({ categorie, total }) => {
        const nom = fr.categories[categorie].nom;
        return (
          <View
            key={categorie}
            accessible
            accessibilityLabel={t.totalCategorie(nom, total)}
            style={styleLigne}
          >
            <IconeCategorie categorie={categorie} couleur={theme.categories[categorie].couleur} />
            <Text style={{ flexGrow: 1, color: c.texte }}>{nom}</Text>
            <Text style={{ color: c.texte }}>{t.montant(total)}</Text>
          </View>
        );
      })}
      <Text style={{ color: c.texte, fontWeight: '600' }}>
        {semaine.coupee ? t.totalJours(semaine.total) : t.totalSemaine(semaine.total)}
      </Text>
    </View>
  );
}

function Depense({ depense }: { depense: DepenseCarnet }) {
  const nom = fr.categories[depense.categorie].nom;
  return (
    <View
      testID={`depense-${depense.id}`}
      accessible
      accessibilityLabel={t.depenseLibelle(depense.montant, nom, depense.note)}
      style={{ ...styleLigne, minHeight: theme.zoneTactileMin }}
    >
      <IconeCategorie
        categorie={depense.categorie}
        couleur={theme.categories[depense.categorie].couleur}
      />
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Text style={{ color: c.texte }}>{nom}</Text>
        {depense.note !== '' && <Text style={{ color: c.texteDiscret }}>{depense.note}</Text>}
      </View>
      <Text style={{ color: c.texte, fontWeight: '600' }}>{t.montant(depense.montant)}</Text>
    </View>
  );
}

function Jour({ jour }: { jour: JourCarnet }) {
  return (
    <View style={{ gap: 4 }}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={t.jourLibelle(jour.jour, jour.total)}
        style={{ ...styleLigne, borderBottomWidth: 1, borderBottomColor: c.jaugeFond }}
      >
        <Text style={{ flexGrow: 1, color: c.texte, fontWeight: '600' }}>{t.jour(jour.jour)}</Text>
        <Text style={{ color: c.texte, fontWeight: '600' }}>{t.totalJour(jour.total)}</Text>
      </View>
      {jour.depenses.map((d) => (
        <Depense key={d.id} depense={d} />
      ))}
    </View>
  );
}

function Semaine({ semaine }: { semaine: SemaineCarnet }) {
  return (
    <View testID={`semaine-${semaine.semaine}`} style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600', color: c.texte }}>
        {t.semaine(semaine.lundi, semaine.dimanche)}
      </Text>
      {semaine.coupee && (
        <Text style={{ color: c.texteDiscret }}>{t.joursDuMois(semaine.debut, semaine.fin)}</Text>
      )}
      <Resultat semaine={semaine} />
      {semaine.jours.length === 0 ? (
        <Text style={{ color: c.texteDiscret }}>
          {semaine.coupee ? t.aucuneDepenseJours : t.aucuneDepense}
        </Text>
      ) : (
        <>
          <Totaux semaine={semaine} />
          {semaine.jours.map((j) => (
            <Jour key={j.jour} jour={j} />
          ))}
        </>
      )}
    </View>
  );
}

export function EcranCarnet({ store, onRetour }: PropsEcranCarnet) {
  const etat = useStore(store, (s) => s.etat);
  const depenses = useStore(store, (s) => s.depenses);
  const maintenant = useStore(store, (s) => s.maintenant);
  const [moisChoisi, setMoisChoisi] = useState(null as string | null);

  const vue = useMemo(() => {
    if (etat === null || maintenant === null) return null;
    const mois = moisChoisi ?? moisCourantDuCarnet(maintenant.day);
    return vueCarnet(depenses, etat.results, etat.installDay, maintenant, mois);
  }, [etat, depenses, maintenant, moisChoisi]);

  return (
    <SafeAreaView
      testID="ecran-carnet"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView
        testID="carnet-defilement"
        contentContainerStyle={{ padding: ESPACE, gap: ESPACE * 1.5 }}
      >
        <View style={{ ...styleLigne, gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.retourLibelle}
            onPress={onRetour}
            style={{ ...styleBouton, alignItems: 'flex-start' }}
          >
            <Text style={{ color: c.texte, fontSize: 17 }}>{t.retour}</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 22, fontWeight: '600', color: c.texte }}
          >
            {t.titre}
          </Text>
        </View>
        {vue !== null && (
          <>
            <Filtre
              mois={vue.mois}
              moisDisponibles={vue.moisDisponibles}
              onChoisir={setMoisChoisi}
            />
            {vue.semaines.map((s) => (
              <Semaine key={s.semaine} semaine={s} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
