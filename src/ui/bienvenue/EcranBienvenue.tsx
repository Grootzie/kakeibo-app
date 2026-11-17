// Bienvenue (E1), à la première ouverture : la méthode, les quatre catégories, mon mois, mon
// rappel du soir. Les trois premières étapes ont chacune leur carte de première fois (J5.8, #107),
// montrée une seule fois : vue avant l'ouverture de E1, ou fermée, elle ne revient pas. À la fin, le store pose le budget, la charge « Charges fixes » et le rappel,
// demande l'autorisation des notifications (un refus n'empêche rien), puis l'accueil s'ouvre.
// Ne parle qu'au store, qui seul appelle le domaine et les dépôts.
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { fr } from '../../i18n/fr';
import { apercuBudget } from '../../state/bienvenue';
import type { IdExplication } from '../../state/explications';
import { maisonAccueil } from '../../state/maison';
import { HEURE_RAPPEL_DEFAUT, type KakeiboStore } from '../../state/store';
import { lireMontant } from '../depense/montant';
import { IconeCategorie } from '../depense/IconeCategorie';
import { CarteExplication } from '../explication/CarteExplication';
import { Maison } from '../maison/Maison';
import { ReglageHeure } from '../ReglageHeure';
import { type CategorieId, theme } from '../theme';

const c = theme.couleurs;
const b = fr.bienvenue;
const ESPACE = 16;
const ETAPES = 4;
const CATEGORIES: readonly CategorieId[] = ['essentiel', 'envies', 'culture', 'imprevus'];
/** La carte de première fois de chaque étape (Messages d'explication). */
const CARTE_ETAPE: Readonly<Record<number, IdExplication>> = {
  1: 'welcome_method',
  2: 'welcome_categories',
  3: 'welcome_month',
};

const styleBouton = {
  minHeight: theme.zoneTactileMin,
  borderRadius: 8,
  paddingHorizontal: ESPACE,
  paddingVertical: 12,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export interface PropsEcranBienvenue {
  store: KakeiboStore;
  /** La bienvenue est faite (ou passée) : l'accueil s'ouvre. */
  onArrivee: () => void;
}

/** Un champ vide compte pour 0 € (charges fixes, épargne) ; les revenus, eux, sont requis. */
const lire = (texte: string, videVautZero: boolean) =>
  videVautZero && texte.trim() === '' ? 0 : lireMontant(texte);

export function EcranBienvenue({ store, onArrivee }: PropsEcranBienvenue) {
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);
  const catalogue = useStore(store, (s) => s.catalogue);
  const horlogeTest = useStore(store, (s) => s.horlogeTest);
  const vues = useStore(store, (s) => s.explicationsVues);
  // Cartes vues avant l'ouverture de E1 (redémarrage pendant la bienvenue) : elles ne reviennent
  // pas. Une carte montrée ici reste à son étape jusqu'à sa fermeture.
  const [vuesAvant] = useState(() => store.getState().explicationsVues);
  const [fermees, setFermees] = useState([] as readonly IdExplication[]);

  const [etape, setEtape] = useState(1);
  const [revenus, setRevenus] = useState('');
  const [charges, setCharges] = useState('');
  const [epargne, setEpargne] = useState('');
  const [heure, setHeure] = useState(HEURE_RAPPEL_DEFAUT);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState(false);

  const saisie = {
    income: lire(revenus, false),
    fixedCosts: lire(charges, true),
    savingsGoal: lire(epargne, true),
  };
  const apercu =
    etat !== null && maintenant !== null
      ? apercuBudget(saisie, etat.installDay, maintenant.day)
      : null;

  const maison = useMemo(() => {
    if (etat === null || maintenant === null) return null;
    const vue = maisonAccueil(etat, catalogue, maintenant);
    return vue?.pieces[vue.courante] ?? null;
  }, [etat, catalogue, maintenant]);

  const idCarte = CARTE_ETAPE[etape] as IdExplication | undefined;
  const carte =
    idCarte !== undefined && !vuesAvant.includes(idCarte) && !fermees.includes(idCarte)
      ? idCarte
      : null;

  // Dès qu'elle s'affiche, la carte est marquée vue (settings.seen_explanations).
  useEffect(() => {
    if (carte !== null && !vues.includes(carte)) {
      void store.getState().marquerExplicationVue(carte);
    }
  }, [carte, vues, store]);

  const carteEtape = carte !== null && (
    <CarteExplication key={carte} id={carte} onFermer={() => setFermees((f) => [...f, carte])} />
  );

  const titres = [b.methode.titre, b.categories.titre, b.mois.titre, b.rappel.titre];
  const titre = titres[etape - 1];

  // Le lecteur d'écran annonce chaque nouvelle étape.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${b.etape(etape, ETAPES)}. ${titre}`);
  }, [etape, titre]);

  const peutContinuer = etape !== 3 || apercu?.peutContinuer === true;

  const commencer = async () => {
    const { income, fixedCosts, savingsGoal } = saisie;
    if (envoi || income === null || fixedCosts === null || savingsGoal === null) return;
    setEnvoi(true);
    setRefus(false);
    const r = await store.getState().terminerBienvenue({
      budget: { income, fixedCosts, savingsGoal },
      heureRappel: heure,
    });
    setEnvoi(false);
    if (r === null) onArrivee();
    else setRefus(true);
  };

  const passer = () => {
    if (store.getState().passerBienvenue()) onArrivee();
  };

  const changer = (set: (t: string) => void) => (t: string) => {
    set(t);
    setRefus(false);
  };

  return (
    <SafeAreaView
      testID="ecran-bienvenue"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.fond }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: ESPACE, gap: ESPACE }}
      >
        {/* En haut : les parcours le touchent dès le lancement, sans faire défiler. */}
        {horlogeTest && (
          <Pressable
            testID="passer-bienvenue"
            accessibilityRole="button"
            accessibilityLabel={b.passer}
            onPress={passer}
            style={styleBouton}
          >
            <Text style={{ color: c.texteDiscret }}>{b.passer}</Text>
          </Pressable>
        )}
        <Text style={{ color: c.texteDiscret }}>{b.etape(etape, ETAPES)}</Text>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 24, fontWeight: '600', color: c.texte }}
        >
          {titre}
        </Text>

        {etape === 1 && (
          <>
            {maison !== null && (
              <View
                testID="bienvenue-maison"
                accessible
                accessibilityRole="image"
                accessibilityLabel={maison.description}
              >
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Maison vue={maison} />
                </View>
              </View>
            )}
            {b.methode.gestes.map((g, i) => (
              <View key={g.titre} style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>{i + 1}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>{g.titre}</Text>
                  <Text style={{ color: c.texte }}>{g.texte}</Text>
                </View>
              </View>
            ))}
            <Text style={{ color: c.texte }}>{b.methode.maison}</Text>
            {carteEtape}
          </>
        )}

        {etape === 2 && (
          <>
            {carteEtape}
            {CATEGORIES.map((id) => {
              const nom = fr.categories[id].nom;
              const exemples = b.categories.exemples[id];
              const couleur = theme.categories[id].couleur;
              return (
                <View
                  key={id}
                  accessible
                  accessibilityLabel={b.categories.ligneLibelle(nom, exemples)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 8,
                    borderLeftWidth: 4,
                    borderColor: couleur,
                    backgroundColor: c.discret,
                  }}
                >
                  <IconeCategorie categorie={id} couleur={couleur} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: c.texte, fontSize: 17, fontWeight: '600' }}>{nom}</Text>
                    <Text style={{ color: c.texte }}>{exemples}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {etape === 3 && (
          <>
            {carteEtape}
            <ChampMontant nom={b.mois.revenus} valeur={revenus} onChange={changer(setRevenus)} />
            <ChampMontant
              nom={b.mois.chargesFixes}
              aide={b.mois.chargesFixesAide}
              valeur={charges}
              onChange={changer(setCharges)}
            />
            <ChampMontant nom={b.mois.epargne} valeur={epargne} onChange={changer(setEpargne)} />
            <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
              {apercu?.budgetMois == null ? (
                <Text style={{ color: c.texteDiscret }}>{b.mois.remplir}</Text>
              ) : (
                <Text style={{ color: c.texte, fontSize: 18, fontWeight: '600' }}>
                  {b.mois.budgetMois(apercu.budgetMois)}
                </Text>
              )}
              {apercu?.enveloppeSemaine != null && (
                <Text style={{ color: c.texte, fontSize: 18, fontWeight: '600' }}>
                  {b.mois.enveloppeSemaine(apercu.enveloppeSemaine)}
                </Text>
              )}
              {apercu?.budgetMois != null && !apercu.peutContinuer && (
                <Text style={{ color: c.texte }}>{b.mois.budgetPositif}</Text>
              )}
            </View>
          </>
        )}

        {etape === 4 && (
          <>
            <Texte>{b.rappel.texte}</Texte>
            <ReglageHeure heure={heure} onChange={setHeure} />
            <Texte>{b.rappel.autorisation}</Texte>
            {refus && (
              <Text accessibilityLiveRegion="polite" style={{ color: c.texte }}>
                {b.mois.refus}
              </Text>
            )}
          </>
        )}

        <View style={{ gap: 8 }}>
          {etape < ETAPES ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={b.continuerLibelle}
              accessibilityState={{ disabled: !peutContinuer }}
              disabled={!peutContinuer}
              onPress={() => setEtape((e) => Math.min(ETAPES, e + 1))}
              style={{
                ...styleBouton,
                backgroundColor: c.principal,
                opacity: peutContinuer ? 1 : 0.4,
              }}
            >
              <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
                {b.continuer}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={b.commencerLibelle}
              accessibilityState={{ disabled: envoi, busy: envoi }}
              disabled={envoi}
              onPress={() => void commencer()}
              style={{ ...styleBouton, backgroundColor: c.principal, opacity: envoi ? 0.4 : 1 }}
            >
              <Text style={{ color: c.surPrincipal, fontSize: 17, fontWeight: '600' }}>
                {b.commencer}
              </Text>
            </Pressable>
          )}
          {etape > 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={b.retourLibelle}
              onPress={() => setEtape((e) => Math.max(1, e - 1))}
              style={styleBouton}
            >
              <Text style={{ color: c.texte }}>{b.retour}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Texte({ children }: { children: ReactNode }) {
  return <Text style={{ color: c.texte, lineHeight: 22 }}>{children}</Text>;
}

/** Un montant au pavé numérique, comme en E3 (virgule ou point, deux décimales). */
function ChampMontant({
  nom,
  aide,
  valeur,
  onChange,
}: {
  nom: string;
  aide?: string;
  valeur: string;
  onChange: (texte: string) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: c.texte, fontWeight: '600' }}>{nom}</Text>
      {aide !== undefined && <Text style={{ color: c.texteDiscret }}>{aide}</Text>}
      <TextInput
        keyboardType="decimal-pad"
        accessibilityLabel={b.mois.champLibelle(nom)}
        accessibilityHint={aide}
        value={valeur}
        onChangeText={onChange}
        maxLength={9}
        placeholder={fr.depense.montantExemple}
        placeholderTextColor={c.texteDiscret}
        style={{
          minHeight: theme.zoneTactileMin,
          fontSize: 22,
          fontWeight: '600',
          color: c.texte,
          borderBottomWidth: 2,
          borderColor: c.texte,
        }}
      />
    </View>
  );
}
