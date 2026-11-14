// Bilan d'une semaine (E6, J3.2), en quatre temps : les tampons, le dépensé face à l'enveloppe,
// le résultat (la tirette quand la semaine a tous ses jetons, puis la capsule et l'objet ; sinon
// la poussière ; parfois un objet qui se fêle), puis l'objet et une phrase de conclusion. On
// passe d'un temps à l'autre d'une touche ; chaque temps est lu par le lecteur d'écran. Quitté
// en route, le bilan se rouvre au même endroit ; « Terminer » le marque vu.
import { type ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fr } from '../../i18n/fr';
import type { VueBilanSemaine } from '../../state/selecteurs';
import { theme } from '../theme';
import { Gashapon } from './Gashapon';
import { ObjetProvisoire } from './ObjetProvisoire';
import {
  type EtapeBilan,
  type Temps,
  etapeBilan,
  oublierEtapes,
  retenirEtape,
} from './etapesBilan';

const c = theme.couleurs;
const b = fr.bilanSemaine;
const r = fr.recapitulatif;
const ESPACE = 16;
const NBSP = ' ';

export interface PropsEcranBilanUneSemaine {
  vue: VueBilanSemaine;
  /** Le téléphone demande moins d'animations. */
  reduit: boolean;
  /** Marque le bilan vu ; rend faux si l'enregistrement échoue. */
  onTerminer(): Promise<boolean>;
  /** Retour à l'accueil sans rien marquer vu. */
  onRetour: () => void;
}

/** Texte du résultat (temps 3), selon les quatre cas du tableau de la spec. */
export function texteResultat(vue: VueBilanSemaine): string {
  if (vue.complete) {
    return vue.dansLeBudget
      ? fr.bilan.toutTamponsDansBudget
      : fr.bilan.toutTamponsHorsBudget(vue.fele);
  }
  return vue.fele === null ? fr.bilan.manqueDansBudget : fr.bilan.manqueHorsBudget(vue.fele);
}

/** Phrase à l'ouverture de la capsule : l'objet entre dans la maison, ou attend sa pièce. */
function texteOuverture(vue: VueBilanSemaine): string | null {
  if (vue.objet === null) return null;
  if (vue.enAttente !== null) {
    return fr.messages.objetEnAttente(vue.enAttente.moisPiece, vue.enAttente.moisBilan);
  }
  return fr.messages.ouvertureCapsule(vue.objet);
}

const titre = (t: string, texte: string) => `${t}${NBSP}: ${texte}`;

/** Ce que le lecteur d'écran lit en arrivant sur un temps. */
function annonce(vue: VueBilanSemaine, temps: Temps): string {
  const tete = `${b.temps(temps)}. `;
  switch (temps) {
    case 1:
      return `${tete}${titre(b.tamponsTitre, r.tampons(vue.tampons, vue.jours))}.`;
    case 2:
      return `${tete}${titre(b.enveloppeTitre, b.depense(vue.depense, vue.enveloppe))}. ${
        vue.dansLeBudget ? r.dansEnveloppe : r.horsEnveloppe
      }.`;
    case 3:
      return `${tete}${titre(b.resultatTitre, texteResultat(vue))}`;
    case 4:
      return `${tete}${titre(
        b.maisonTitre,
        vue.objet === null
          ? b.conclusionSansObjet
          : `${b.nomObjet(vue.objet)}. ${b.conclusionObjet}`,
      )}`;
  }
}

function Bouton({
  texte,
  libelle,
  onPress,
  desactive = false,
}: {
  texte: string;
  libelle: string;
  onPress: () => void;
  desactive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      disabled={desactive}
      accessibilityState={{ disabled: desactive }}
      onPress={onPress}
      style={{
        minHeight: theme.zoneTactileMin,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: ESPACE,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.principal,
        opacity: desactive ? 0.4 : 1,
      }}
    >
      <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>{texte}</Text>
    </Pressable>
  );
}

function SousTitre({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600', color: c.texte }}>
      {children}
    </Text>
  );
}

function TempsTampons({ vue }: { vue: VueBilanSemaine }) {
  return (
    <View
      accessible
      accessibilityLabel={titre(b.tamponsTitre, r.tampons(vue.tampons, vue.jours))}
      style={{ gap: 12, alignItems: 'center' }}
    >
      <Text style={{ fontSize: 18, fontWeight: '600', color: c.texte }}>{b.tamponsTitre}</Text>
      <Text style={{ fontSize: 48, fontWeight: '700', color: c.texte }}>
        {b.tamponsSur(vue.tampons, vue.jours)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {Array.from({ length: vue.jours }, (_, i) => (
          <View
            key={i}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 3,
              borderColor: c.principal,
              borderStyle: i < vue.tampons ? 'solid' : 'dashed',
              backgroundColor: i < vue.tampons ? c.principal : c.fond,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function TempsEnveloppe({ vue }: { vue: VueBilanSemaine }) {
  const part = vue.enveloppe > 0 ? Math.min(1, vue.depense / vue.enveloppe) : 1;
  return (
    <View style={{ gap: 12 }}>
      <SousTitre>{b.enveloppeTitre}</SousTitre>
      <Text style={{ fontSize: 20, color: c.texte }}>{b.depense(vue.depense, vue.enveloppe)}</Text>
      <View
        style={{ height: 12, borderRadius: 6, backgroundColor: c.jaugeFond, overflow: 'hidden' }}
      >
        <View style={{ height: 12, width: `${part * 100}%`, backgroundColor: c.jauge }} />
      </View>
      <Text style={{ color: c.texte }}>{vue.dansLeBudget ? r.dansEnveloppe : r.horsEnveloppe}</Text>
    </View>
  );
}

function Poussiere() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={b.poussiereLibelle}
      style={{
        alignSelf: 'center',
        width: 160,
        height: 100,
        borderRadius: 12,
        backgroundColor: c.jaugeFond,
        opacity: 0.8,
      }}
    />
  );
}

function TempsResultat({
  vue,
  etape,
  reduit,
  ouverte,
  onOuverte,
}: {
  vue: VueBilanSemaine;
  etape: EtapeBilan;
  reduit: boolean;
  ouverte: boolean;
  onOuverte: () => void;
}) {
  const ouverture = texteOuverture(vue);
  return (
    <View style={{ gap: 12 }}>
      <SousTitre>{b.resultatTitre}</SousTitre>
      <Text style={{ color: c.texte, fontSize: 17 }}>{texteResultat(vue)}</Text>
      {vue.objet !== null ? (
        <Gashapon objet={vue.objet} tiree={etape.tiree} reduit={reduit} onOuverte={onOuverte} />
      ) : (
        <Poussiere />
      )}
      {ouverte && ouverture !== null && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.texte, fontSize: 17 }}>
          {ouverture}
        </Text>
      )}
      {vue.fele !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ObjetProvisoire objet={vue.fele} taille={48} fele libelle={fr.messages.fele(vue.fele)} />
          <Text style={{ flex: 1, color: c.texteDiscret }}>{b.nomObjet(vue.fele)}</Text>
        </View>
      )}
    </View>
  );
}

function TempsMaison({ vue }: { vue: VueBilanSemaine }) {
  return (
    <View style={{ gap: 12, alignItems: 'center' }}>
      <SousTitre>{b.maisonTitre}</SousTitre>
      {vue.objet !== null && (
        <>
          <ObjetProvisoire objet={vue.objet} taille={128} libelle={b.objetLibelle(vue.objet)} />
          <Text style={{ fontSize: 20, fontWeight: '600', color: c.texte }}>
            {b.nomObjet(vue.objet)}
          </Text>
        </>
      )}
      <Text style={{ color: c.texte, fontSize: 17, textAlign: 'center' }}>
        {vue.objet === null ? b.conclusionSansObjet : b.conclusionObjet}
      </Text>
    </View>
  );
}

export function EcranBilanUneSemaine({
  vue,
  reduit,
  onTerminer,
  onRetour,
}: PropsEcranBilanUneSemaine) {
  const [etape, setEtape] = useState<EtapeBilan>(() => etapeBilan(vue.semaine));
  // Capsule ouverte : tout de suite si la tirette était déjà tirée (bilan rouvert).
  const [ouverte, setOuverte] = useState(etape.tiree);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState(false);

  const changer = (suivante: EtapeBilan) => {
    retenirEtape(vue.semaine, suivante);
    setEtape(suivante);
  };

  // Chaque temps est lu par le lecteur d'écran dès qu'il s'affiche.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(annonce(vue, etape.temps));
  }, [vue, etape.temps]);

  const capsuleOuverte = () => {
    setOuverte(true);
    const texte = texteOuverture(vue);
    if (texte !== null) AccessibilityInfo.announceForAccessibility(texte);
  };

  const terminer = async () => {
    if (envoi) return;
    setEnvoi(true);
    setRefus(false);
    const ok = await onTerminer();
    setEnvoi(false);
    if (ok) oublierEtapes(vue.semaine);
    else setRefus(true);
  };

  let contenu: ReactNode;
  let action: ReactNode;
  const suivant = (
    <Bouton
      texte={b.suivant}
      libelle={b.suivantLibelle}
      onPress={() => changer({ ...etape, temps: (etape.temps + 1) as Temps })}
    />
  );
  switch (etape.temps) {
    case 1:
      contenu = <TempsTampons vue={vue} />;
      action = suivant;
      break;
    case 2:
      contenu = <TempsEnveloppe vue={vue} />;
      action = suivant;
      break;
    case 3:
      contenu = (
        <TempsResultat
          vue={vue}
          etape={etape}
          reduit={reduit}
          ouverte={ouverte}
          onOuverte={capsuleOuverte}
        />
      );
      // Avec un objet, la tirette d'abord ; on passe au temps 4 une fois la capsule ouverte.
      action =
        vue.objet === null || ouverte ? (
          suivant
        ) : etape.tiree ? null : (
          <Bouton
            texte={b.tirer}
            libelle={b.tirerLibelle}
            onPress={() => changer({ ...etape, tiree: true })}
          />
        );
      break;
    case 4:
      contenu = <TempsMaison vue={vue} />;
      action = (
        <Bouton
          texte={b.terminer}
          libelle={b.terminerLibelle}
          desactive={envoi}
          onPress={() => void terminer()}
        />
      );
      break;
  }

  return (
    <SafeAreaView
      testID="ecran-bilan-semaine"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView contentContainerStyle={{ padding: ESPACE, gap: ESPACE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fr.bilan.retourLibelle}
            onPress={onRetour}
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
            {fr.bilan.titreSemaine}
          </Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.texte, fontWeight: '600' }}>{r.semaine(vue.lundi)}</Text>
          <Text style={{ color: c.texteDiscret }}>{b.temps(etape.temps)}</Text>
        </View>

        {contenu}

        {refus && (
          <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
            {b.refus}
          </Text>
        )}
        {action}
      </ScrollView>
    </SafeAreaView>
  );
}
