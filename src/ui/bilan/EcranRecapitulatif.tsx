// Récapitulatif après une longue absence (E6, J3.3) : un seul écran pour les semaines manquées,
// à la place des bilans un par un. Une ligne par semaine, de la plus ancienne à la plus récente
// (tampons, enveloppe, objet gagné ou poussière, objet fêlé), puis la poussière et la file de
// réparation. Ton qui constate et encourage. « Continuer » marque toutes les semaines vues.
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fr } from '../../i18n/fr';
import type { LigneRecapitulatif, VueRecapitulatif } from '../../state/selecteurs';
import { theme } from '../theme';

const c = theme.couleurs;
const r = fr.recapitulatif;
const ESPACE = 16;

export interface PropsEcranRecapitulatif {
  vue: VueRecapitulatif;
  /** Marque toutes les semaines vues ; rend faux si l'enregistrement échoue. */
  onContinuer(): Promise<boolean>;
  /** Retour à l'accueil sans rien marquer vu. */
  onRetour: () => void;
}

/** Les morceaux d'une ligne, dans l'ordre où ils s'affichent et se lisent. */
function morceaux(l: LigneRecapitulatif): string[] {
  return [
    r.semaine(l.lundi),
    r.tampons(l.tampons, l.jours),
    l.dansLeBudget ? r.dansEnveloppe : r.horsEnveloppe,
    l.objetGagne === null ? r.poussiere : r.objetGagne(l.objetGagne),
    ...(l.objetFele === null ? [] : [r.objetFele(l.objetFele)]),
  ];
}

/** Une semaine, lue d'un seul tenant par le lecteur d'écran. */
function LigneSemaine({ ligne }: { ligne: LigneRecapitulatif }) {
  const [titre, ...details] = morceaux(ligne);
  return (
    <View
      accessible
      accessibilityLabel={r.ligneLibelle(morceaux(ligne))}
      style={{
        gap: 4,
        padding: 12,
        borderRadius: 8,
        backgroundColor: c.discret,
      }}
    >
      <Text style={{ color: c.texte, fontWeight: '600' }}>{titre}</Text>
      {details.map((d) => (
        <Text key={d} style={{ color: c.texte }}>
          {d}
        </Text>
      ))}
    </View>
  );
}

function Maison({ vue }: { vue: VueRecapitulatif }) {
  const { poussiere, reparations } = vue;
  const phrases: string[] = [];
  if (poussiere.niveau === 0) phrases.push(r.maisonPropre);
  if (poussiere.niveau > 0 && poussiere.joursSansCloture) phrases.push(fr.messages.poussiereJours);
  if (poussiere.niveau > 0 && poussiere.semaineIncomplete)
    phrases.push(fr.messages.poussiereSemaineIncomplete);
  if (reparations.length === 0) phrases.push(r.reparationAucune);
  // Les objets se réparent un par un : seul le premier de la file progresse.
  const file = reparations.map((x, i) => {
    return i === 0 ? r.reparationEnCours(x.objet, x.progression) : r.reparationEnsuite(x.objet);
  });
  phrases.push(...file);
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600', color: c.texte }}>
        {r.maisonTitre}
      </Text>
      {phrases.map((p) => (
        <Text key={p} style={{ color: c.texte }}>
          {p}
        </Text>
      ))}
    </View>
  );
}

export function EcranRecapitulatif({ vue, onContinuer, onRetour }: PropsEcranRecapitulatif) {
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState(false);

  const continuer = async () => {
    if (envoi) return;
    setEnvoi(true);
    setRefus(false);
    const ok = await onContinuer();
    setEnvoi(false);
    if (!ok) setRefus(true);
  };

  return (
    <SafeAreaView
      testID="ecran-recapitulatif"
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
            {r.titre}
          </Text>
        </View>

        <Text style={{ color: c.texte }}>{r.intro}</Text>

        <View style={{ gap: 8 }}>
          {vue.semaines.map((l) => (
            <LigneSemaine key={l.semaine} ligne={l} />
          ))}
        </View>

        <Maison vue={vue} />

        <Text style={{ color: c.texte }}>{r.conclusion}</Text>

        {refus && (
          <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
            {r.refus}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={r.continuer}
          disabled={envoi}
          accessibilityState={{ disabled: envoi }}
          onPress={() => void continuer()}
          style={{
            minHeight: theme.zoneTactileMin,
            borderRadius: 8,
            paddingVertical: 12,
            paddingHorizontal: ESPACE,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.principal,
            opacity: envoi ? 0.4 : 1,
          }}
        >
          <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
            {r.continuer}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
