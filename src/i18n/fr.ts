// Tous les textes visibles de l'appli (voir « Textes et ton » dans docs/spec.md).
// Espaces insécables : U+00A0 avant ? ! : ; et à l'intérieur des guillemets « ».

import { RESOLUTION_MAX_LENGTH } from '../domain/bilanMois';
import { MAX_AMOUNT, MIN_AMOUNT, NOTE_MAX_LENGTH } from '../domain/depense';

const NBSP = ' ';

export type Genre = 'm' | 'f';

/**
 * Nom d'objet tel que le donne le catalogue, avec article et genre. L'article « les » dit le
 * pluriel : « Les étagères se sont fêlées », « Des lanternes de papier entrent dans ta maison. »
 */
export interface NomObjet {
  readonly nom: string;
  readonly article: 'le' | 'la' | "l'" | 'les';
  readonly genre: Genre;
}

/** Montant en centimes -> « 63 € », « 63,50 € », « −12 € ». */
export function formatEuros(centimes: number): string {
  const signe = centimes < 0 ? '−' : '';
  const absolu = Math.abs(centimes);
  const euros = Math.trunc(absolu / 100);
  const reste = absolu % 100;
  const entiers = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimales = reste === 0 ? '' : `,${String(reste).padStart(2, '0')}`;
  return `${signe}${entiers}${decimales}${NBSP}€`;
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** Jour 'AAAA-MM-JJ' -> « lundi ». */
export function nomDuJour(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  return JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
}

/** Jour 'AAAA-MM-JJ' -> « vendredi 6 novembre », « dimanche 1er mars » (insécable avant le mois). */
export function jourEtDate(jour: string): string {
  const [, m, j] = jour.split('-').map(Number);
  return `${nomDuJour(jour)} ${j === 1 ? '1er' : j}${NBSP}${MOIS[m - 1]}`;
}

/** Mois 'AAAA-MM' -> « novembre ». */
export function nomDuMois(mois: string): string {
  return MOIS[Number(mois.slice(5, 7)) - 1];
}

/**
 * « de » devant un nom : « de mars », « d’avril », « d’Ōmisoka », « des récoltes d’automne ».
 * Les mots japonais en h (Hinamatsuri, Hanami) ne s'élident pas.
 */
export function de(nom: string): string {
  if (nom.startsWith('Les ')) return `des ${nom.slice(4)}`;
  const initiale = nom.normalize('NFD')[0].toLowerCase();
  return 'aeiouy'.includes(initiale) ? `d’${nom}` : `de ${nom}`;
}

/** Mois 'AAAA-MM' -> « de novembre », « d’avril ». */
const duMois = (mois: string): string => de(nomDuMois(mois));

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const;

/** Jour 'AAAA-MM-JJ' -> « mer. 4 ». */
export function jourCourt(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  return `${JOURS_COURTS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]}${NBSP}${j}`;
}

/** Les cinq états d'une case de la carte de tampons, tels que le lecteur d'écran les annonce. */
const ETATS_CASE = {
  cloturee: 'clôturé',
  a_cloturer: 'à clôturer aujourd’hui',
  rattrapable: 'à rattraper',
  hors_decompte: 'hors décompte',
  a_venir: 'à venir',
} as const;

function debut(objet: NomObjet): string {
  return majuscule(avecArticle(objet));
}

function majuscule(texte: string): string {
  return `${texte[0].toUpperCase()}${texte.slice(1)}`;
}

function avecArticle(objet: NomObjet): string {
  const article = objet.article === "l'" ? 'l’' : `${objet.article} `;
  return `${article}${objet.nom}`;
}

/** Article indéfini : « un daruma », « une échelle », « des étagères ». */
function indefini(objet: NomObjet): string {
  const article = objet.article === 'les' ? 'des' : objet.genre === 'f' ? 'une' : 'un';
  return `${article} ${objet.nom}`;
}

/**
 * Jour 'AAAA-MM-JJ' -> « 2 novembre », « 1er mars » (insécable avant le mois) ; « 15 » seul quand
 * la date précédente de la phrase est du même mois.
 */
function dateDansLeMois(jour: string, precedent: string | null): string {
  const [, m, j] = jour.split('-').map(Number);
  const numero = j === 1 ? '1er' : String(j);
  return precedent !== null && precedent.slice(0, 7) === jour.slice(0, 7)
    ? numero
    : `${numero}${NBSP}${MOIS[m - 1]}`;
}

/** Accord en genre et en nombre : masculin, féminin, puis leurs pluriels. */
function accord(
  objet: NomObjet,
  masculin: string,
  feminin: string,
  masculinPluriel: string,
  femininPluriel: string,
): string {
  if (objet.article === 'les') return objet.genre === 'f' ? femininPluriel : masculinPluriel;
  return objet.genre === 'f' ? feminin : masculin;
}

/** « s’est fêlé », « s’est fêlée », « se sont fêlés », « se sont fêlées ». */
const sEstFele = (objet: NomObjet): string =>
  accord(objet, 's’est fêlé', 's’est fêlée', 'se sont fêlés', 'se sont fêlées');

/** « il sera réparé », « elle sera réparée », « ils seront réparés », « elles seront réparées ». */
const seraRepare = (objet: NomObjet): string =>
  accord(
    objet,
    'il sera réparé',
    'elle sera réparée',
    'ils seront réparés',
    'elles seront réparées',
  );

export const fr = {
  app: {
    name: 'Kakeibo',
  },

  dev: {
    horlogeTitre: 'Horloge de test',
    horlogeEtat: (jours: number) => `Décalage : ${jours} jour${jours > 1 ? 's' : ''}`,
    plusUnJour: '+1 jour',
    plusUneSemaine: '+1 semaine',
    plusUnMois: '+1 mois',
    reinitialiser: 'Réinitialiser',
    libelleOuvrir: 'Ouvrir l’horloge de test',
    budgetDemo: 'Poser un budget de démonstration',
    budgetDemoLibelle: `Poser un budget de démonstration${NBSP}: ${formatEuros(120000)} de revenus, ${formatEuros(60000)} de charges fixes, ${formatEuros(0)} d’épargne`,
    budgetDemoPose: 'Budget de démonstration posé',
    budgetDemoDejaLa: 'Un budget existe déjà',
    autoriserRappel: 'Autoriser le rappel du soir',
    autoriserRappelLibelle: `Autoriser le rappel du soir${NBSP}: demande l’autorisation des notifications`,
    rappelAutorise: 'Rappel du soir autorisé',
    rappelRefuse: `Notifications refusées${NBSP}: aucun rappel`,
    /** Raccourci des parcours : E6 (J3.2) les marque vus lui-même, à la fin du bilan. */
    bilansVus: 'Marquer les bilans de semaine vus',
    bilansVusFait: 'Bilans de semaine marqués vus',
  },

  notifications: {
    /** Nom du canal de notifications, visible dans les réglages d'Android. */
    canalRappel: 'Rappel du soir',
  },

  vocabulaire: {
    noter: 'Noter',
    cloturer: 'Clôturer',
    tampon: 'Tampon',
    enveloppe: 'Enveloppe',
    bilan: 'Bilan',
    resolution: 'Résolution',
    capsule: 'Capsule',
    jeton: 'Jeton',
    tirette: 'Tirette',
    album: 'Album',
  },

  budget: {
    /** Première dépense récurrente, tirée du montant de charges fixes saisi à la bienvenue (E1). */
    chargesFixes: 'Charges fixes',
  },

  /** Bienvenue (E1), à la première ouverture : quatre étapes, puis l'accueil. */
  bienvenue: {
    etape: (n: number, total: number) => `Étape ${n} sur ${total}`,
    continuer: 'Continuer',
    continuerLibelle: `Continuer${NBSP}: étape suivante`,
    retour: 'Retour',
    retourLibelle: 'Retour à l’étape précédente',
    commencer: 'Commencer',
    commencerLibelle: `Commencer${NBSP}: enregistrer mon budget et mon rappel, puis aller à l’accueil`,
    methode: {
      titre: 'La méthode en une minute',
      gestes: [
        { titre: 'Noter', texte: 'Chaque dépense, toi-même, au moment où tu la fais.' },
        {
          titre: 'Clôturer chaque soir',
          texte: `Tu confirmes avoir tout noté${NBSP}: un tampon se pose sur ta journée.`,
        },
        {
          titre: 'Faire le bilan',
          texte: 'Chaque semaine et chaque mois, tu regardes où va ton argent.',
        },
      ],
      maison: `Ta régularité fait vivre une maison japonaise${NBSP}: une semaine complète y fait entrer un objet.`,
    },
    categories: {
      titre: 'Les quatre catégories',
      /**
       * Deux exemples par catégorie (E1). Ce sont les deux premiers de la liste
       * donnée par le propriétaire dans #101.
       */
      exemples: {
        essentiel: 'les courses, le transport',
        envies: 'un restaurant, des vêtements',
        culture: 'un livre, une place de cinéma',
        imprevus: 'une réparation, un médicament',
      },
      ligneLibelle: (categorie: string, exemples: string) =>
        `${categorie}${NBSP}: par exemple ${exemples}`,
    },
    mois: {
      titre: 'Mon mois',
      revenus: 'Mes revenus du mois',
      chargesFixes: 'Mes charges fixes du mois',
      chargesFixesAide: 'Loyer, abonnements, assurances… Tu pourras les détailler ensuite.',
      epargne: 'Mon épargne visée',
      champLibelle: (nom: string) => `${nom}, en euros`,
      budgetMois: (centimes: number) => `Budget du mois${NBSP}: ${formatEuros(centimes)}`,
      enveloppeSemaine: (centimes: number) =>
        `Enveloppe de cette semaine${NBSP}: ${formatEuros(centimes)}`,
      remplir: 'Indique tes revenus pour voir ton budget du mois.',
      budgetPositif: `Ton budget du mois doit être supérieur à ${formatEuros(0)} pour continuer.`,
      refus: 'Ton budget n’a pas pu être enregistré. Vérifie les montants.',
    },
    rappel: {
      titre: 'Mon rappel du soir',
      texte: `Chaque soir, à l’heure choisie, un rappel t’invite à clôturer ta journée, si ce n’est pas déjà fait. Une notification par jour, au plus.`,
      heureLibelle: (heure: string) => `Heure du rappel${NBSP}: ${heure.replace(':', ' h ')}`,
      heureIndice: 'Balaie vers le haut ou vers le bas pour changer l’heure.',
      plusTot: 'Plus tôt',
      plusTotLibelle: (minutes: number) => `Rappel ${minutes} minutes plus tôt`,
      plusTard: 'Plus tard',
      plusTardLibelle: (minutes: number) => `Rappel ${minutes} minutes plus tard`,
      autorisation: `En commençant, ton téléphone te demande d’autoriser les notifications. Tu peux refuser${NBSP}: l’appli fonctionne aussi sans.`,
    },
    /** Réglage caché des builds de développement : les parcours existants partent de l'accueil. */
    passer: 'Passer la bienvenue (horloge de test)',
  },

  categories: {
    essentiel: { nom: 'Essentiel', libelleAccessibilite: 'Catégorie Essentiel' },
    envies: { nom: 'Envies', libelleAccessibilite: 'Catégorie Envies' },
    culture: { nom: 'Culture', libelleAccessibilite: 'Catégorie Culture' },
    imprevus: { nom: 'Imprévus', libelleAccessibilite: 'Catégorie Imprévus' },
  },

  accueil: {
    noterDepense: 'Noter une dépense',
    noterDepenseLibelle: 'Noter une dépense',
    date: jourEtDate,
    carnet: 'Carnet',
    carnetLibelle: 'Ouvrir le carnet',
    reglages: 'Réglages',
    reglagesLibelle: 'Ouvrir les réglages',
    budgetSemaine: (centimes: number) => `Budget de la semaine${NBSP}: ${formatEuros(centimes)}`,
    jaugeLibelle: (depense: number, enveloppe: number) =>
      `Dépensé${NBSP}: ${formatEuros(depense)} sur ${formatEuros(enveloppe)}`,
    carteTampons: 'Tampons de la semaine',
    /** Initiale du jour sur sa case, du lundi au dimanche. */
    initiale: (jour: string) => nomDuJour(jour)[0].toUpperCase(),
    caseLibelle: (jour: string, etat: keyof typeof ETATS_CASE) =>
      `${nomDuJour(jour)}, ${ETATS_CASE[etat]}`,
    cloturerJournee: 'Clôturer ma journée',
    journeeCloturee: 'Journée clôturée',
    bandeauRattraper: (jour: string) => `Tu peux encore rattraper ${jourEtDate(jour)}.`,
    bandeauBilanSemaine: 'Le bilan de ta semaine est prêt.',
    bandeauBilanSemaines: 'Le bilan de tes dernières semaines est prêt.',
    /** Mois 'AAAA-MM' -> « Le bilan de novembre est prêt. » */
    bandeauBilanMois: (mois: string) => `Le bilan ${duMois(mois)} est prêt.`,
    /** Q4 du bilan du mois précédent, affichée tout le mois. */
    bandeauResolution: (resolution: string) =>
      `Ta résolution du mois${NBSP}: «${NBSP}${resolution}${NBSP}»`,
    reste: (centimes: number, jusqua: string) =>
      `Il te reste ${formatEuros(centimes)} jusqu’à ${jusqua}`,
    depassement: (centimes: number) => `Tu as dépassé de ${formatEuros(centimes)} cette semaine`,
    /**
     * La maison de l'accueil (#84), lue comme un curseur : la description de la pièce, sa place
     * parmi les pièces de l'année, et ce que fait la touche. Textes proposés au propriétaire.
     */
    maisonPosition: (rang: number, total: number) => `Pièce ${rang} sur ${total}`,
    maisonIndice: 'Ouvre ta maison. Tu peux aussi passer d’une pièce à l’autre.',
  },

  depense: {
    titre: 'Noter une dépense',
    fermer: 'Fermer',
    fermerLibelle: 'Fermer sans enregistrer',
    montantLibelle: 'Montant en euros',
    montantExemple: `0,00${NBSP}€`,
    bornes: `De ${formatEuros(MIN_AMOUNT)} à ${formatEuros(MAX_AMOUNT)}`,
    categories: 'Catégorie',
    categorieLibelle: (categorie: string) => `Enregistrer en ${categorie}`,
    date: 'Date',
    aujourdhui: 'Aujourd’hui',
    hier: 'Hier',
    jourCourt,
    jourLibelle: jourEtDate,
    note: 'Note',
    noteLibelle: `Note facultative, ${NOTE_MAX_LENGTH} caractères au plus`,
    noteExemple: 'Facultative',
    noteCompteur: (n: number) => `${n}/${NOTE_MAX_LENGTH}`,
    refus: 'Cette dépense n’a pas pu être notée. Vérifie la date et réessaie.',
    notee: (centimes: number, categorie: string) =>
      `${formatEuros(centimes)} noté en ${categorie}.`,
    annuler: 'Annuler',
    annulerLibelle: 'Annuler cette dépense',
  },

  cloture: {
    titre: 'Clôturer ma journée',
    /** Titre de E5 : « Rattraper mercredi 4 novembre ». */
    titreRattrapage: (jour: string) => `Rattraper ${jourEtDate(jour)}`,
    date: jourEtDate,
    retour: 'Retour',
    retourLibelle: 'Retour à l’accueil',
    depensesDuJour: 'Dépenses du jour',
    aucuneDepense: 'Aucune dépense notée ce jour.',
    depense: (centimes: number, categorie: string, note: string) =>
      `${formatEuros(centimes)} en ${categorie}${note === '' ? '' : `, ${note}`}`,
    totauxTitre: 'Total par catégorie',
    totalCategorie: (categorie: string, centimes: number) =>
      `${categorie}${NBSP}: ${formatEuros(centimes)}`,
    total: (centimes: number) => `Total du jour${NBSP}: ${formatEuros(centimes)}`,
    ajouterOubliee: 'Ajouter une dépense oubliée',
    toutNote: 'J’ai tout noté',
    rienDepense: 'Rien dépensé aujourd’hui',
    journeeCloturee: 'Journée clôturée',
    /** Inscription du tampon, en attendant les visuels. */
    tampon: 'Clôturé',
    tamponPose: (jour: string) => `Tampon posé sur ${jourEtDate(jour)}.`,
    /** Annonce du lecteur d'écran à la clôture : le tampon, puis le jeton (J3.8). */
    tamponEtJeton: (jour: string) =>
      `Tampon posé sur ${jourEtDate(jour)}. Un jeton tombe dans la machine.`,
    /** Après l'annonce d'une réparation, l'écran attend qu'on continue. */
    continuer: 'Continuer',
    continuerLibelle: 'Continuer et revenir à l’accueil',
    /** Machine à capsules de la clôture, en attendant les visuels. */
    machineLibelle: `Machine à capsules${NBSP}: un jeton tombe dans la fente.`,
    /** Refus du domaine, expliqués sans reproche. */
    refus: {
      already_closed: `Ce jour est déjà clôturé${NBSP}: son tampon est posé.`,
      week_sealed: `Sa semaine est déjà scellée, alors ce jour ne se clôture plus. Rien n’est perdu${NBSP}: la semaine en cours t’attend.`,
      future_day: `Ce jour n’est pas encore arrivé${NBSP}: tu pourras le clôturer le soir venu.`,
      before_install: `Ce jour précède l’installation de l’appli${NBSP}: il n’a pas besoin de tampon.`,
      autre: 'Ta journée n’a pas pu être clôturée. Réessaie dans un instant.',
    },
  },

  rappels: [
    `Ta journée est-elle complète${NBSP}?`,
    'Un tampon t’attend ce soir.',
    `Deux minutes pour clôturer ta journée${NBSP}?`,
  ],

  bilan: {
    titreSemaine: 'Bilan de la semaine',
    titreMois: (mois: string) => `Bilan ${duMois(mois)}`,
    titreMoisSans: 'Bilan du mois',
    retour: 'Retour',
    retourLibelle: 'Retour à l’accueil',
    /** Résultat d'une semaine (temps 3 de E6), textes de la spec, révision 847. */
    toutTamponsDansBudget: `Tous tes tampons, et dans ton enveloppe${NBSP}: tes jetons sont prêts, tire la tirette.`,
    /** Sans objet à fêler (tous fêlés ou réparés, scénario 13), la phrase de la fêlure tombe. */
    toutTamponsHorsBudget: (objet: NomObjet | null) =>
      `Tu as tout noté, c’est l’essentiel${NBSP}: tes jetons sont prêts, tire la tirette.${
        objet === null
          ? ''
          : ` ${debut(objet)} ${sEstFele(objet)}${NBSP}; 7 jours de clôture d’affilée, et ${seraRepare(objet)} à l’or.`
      }`,
    manqueDansBudget: `Il manque des tampons cette semaine, alors pas de capsule. Un peu de poussière s’est posée${NBSP}; une semaine complète, et elle s’envole.`,
    manqueHorsBudget: (objet: NomObjet) =>
      `Pas de capsule cette semaine, et ${avecArticle(objet)} ${sEstFele(objet)}. Rien n’est perdu${NBSP}: 7 jours de clôture d’affilée, et ${seraRepare(objet)} à l’or.`,
  },

  /**
   * Bilan d'une semaine (E6, #62), en quatre temps. Les textes du résultat sont dans `bilan` et
   * `messages` (spec) ; les autres sont absents de « Textes et ton », proposés au propriétaire
   * dans la demande de fusion.
   */
  bilanSemaine: {
    /** « Temps 1 sur 4 », pour le lecteur d'écran et sous le titre. */
    temps: (n: number) => `Temps ${n} sur 4`,
    tamponsTitre: 'Tes tampons',
    /** « 7 sur 7 », en grand. */
    tamponsSur: (tampons: number, jours: number) => `${tampons} sur ${jours}`,
    enveloppeTitre: 'Ton enveloppe',
    depense: (depense: number, enveloppe: number) =>
      `Dépensé${NBSP}: ${formatEuros(depense)} sur ${formatEuros(enveloppe)}`,
    resultatTitre: 'Ta semaine',
    machineLibelle: 'Machine à capsules',
    tirer: 'Tirer la tirette',
    tirerLibelle: `Tirer la tirette${NBSP}: la capsule tombe et s’ouvre sur l’objet de la semaine`,
    poussiereLibelle: 'Un peu de poussière',
    maisonTitre: 'Ta maison',
    nomObjet: (objet: NomObjet) => debut(objet),
    conclusionObjet: `Une nouvelle semaine commence${NBSP}: chaque soir, un jeton t’attend.`,
    conclusionSansObjet: `Rien n’est perdu${NBSP}: une clôture ce soir, et tout repart.`,
    suivant: 'Suivant',
    suivantLibelle: 'Passer au temps suivant',
    terminer: 'Terminer',
    terminerLibelle: 'Terminer le bilan et revenir à l’accueil',
    refus: 'Ton bilan n’a pas pu être enregistré. Réessaie dans un instant.',
  },

  /**
   * Récapitulatif après une longue absence (E6, #63) : un seul écran pour les semaines manquées.
   * Textes absents de « Textes et ton », proposés au propriétaire dans la demande de fusion.
   */
  recapitulatif: {
    titre: 'Tes dernières semaines',
    intro: 'Voici ce que tes dernières semaines ont donné.',
    /** Lundi 'AAAA-MM-JJ' -> « Semaine du 2 novembre ». */
    semaine: (lundi: string) => {
      const [, m, j] = lundi.split('-').map(Number);
      return `Semaine du ${j === 1 ? '1er' : j}${NBSP}${MOIS[m - 1]}`;
    },
    tampons: (tampons: number, jours: number) =>
      `${tampons} tampon${tampons > 1 ? 's' : ''} sur ${jours}`,
    dansEnveloppe: 'Dans ton enveloppe',
    horsEnveloppe: 'Au-delà de ton enveloppe',
    objetGagne: (nom: string) => `Objet gagné${NBSP}: ${nom}`,
    poussiere: 'Pas de capsule, un peu de poussière',
    objetFele: (nom: string) => `Objet fêlé${NBSP}: ${nom}`,
    /** Une semaine lue d'un seul tenant par le lecteur d'écran. */
    ligneLibelle: (morceaux: readonly string[]) => `${morceaux.join('. ')}.`,
    maisonTitre: 'Ta maison',
    maisonPropre: 'Ta maison est propre.',
    /** « Réparation : x jours sur 7 » (Fêlure et réparation), avec le nom de l'objet. */
    reparationEnCours: (nom: string, jours: number) =>
      `Réparation${NBSP}: ${jours} jour${jours > 1 ? 's' : ''} sur 7 (${nom})`,
    reparationEnsuite: (nom: string) => `À réparer ensuite${NBSP}: ${nom}`,
    reparationAucune: 'Aucun objet à réparer.',
    conclusion: `Rien n’est perdu${NBSP}: une clôture ce soir, et tout repart.`,
    continuer: 'Continuer',
    refus: 'Ton récapitulatif n’a pas pu être enregistré. Réessaie dans un instant.',
  },

  /** Bilan du mois (E7) : les quatre questions, puis la validation. */
  bilanMois: {
    q1: 'Ce que j’avais',
    q2: 'Ce que je voulais mettre de côté',
    q3: 'Ce que j’ai dépensé',
    epargne: 'Ce que j’ai vraiment épargné',
    /** Une question et sa réponse chiffrée, lues ensemble par le lecteur d'écran. */
    ligne: (question: string, centimes: number) => `${question}${NBSP}: ${formatEuros(centimes)}`,
    montant: formatEuros,
    aucuneDepense: 'Aucune dépense notée ce mois-ci.',
    sansBudget: 'Aucun budget n’était posé pour ce mois.',
    objectifAtteint: 'Tu as mis de côté ce que tu voulais.',
    objectifManque:
      'Ton épargne n’a pas atteint ton objectif ce mois-ci. Le voir, c’est déjà le cœur du kakeibo.',
    q4: `Comment puis-je faire mieux${NBSP}?`,
    q4Libelle: `Comment puis-je faire mieux${NBSP}? Texte libre, ${RESOLUTION_MAX_LENGTH} caractères au plus`,
    q4Exemple: 'Facultatif',
    compteur: (n: number) => `${n}/${RESOLUTION_MAX_LENGTH}`,
    valider: 'Valider mon bilan',
    refus: 'Ton bilan n’a pas pu être enregistré. Réessaie dans un instant.',
    rienAFaire: 'Aucun bilan du mois à faire pour l’instant.',
    enregistre: (mois: string) => `Bilan ${duMois(mois)} enregistré.`,
    /** Confirmation du budget du nouveau mois (J3.5), pré-rempli avec la version en vigueur. */
    budgetTitre: (mois: string) => `Ton budget ${duMois(mois)}`,
    budgetIntro:
      'Voici ton budget pour le mois qui commence. Change un montant si ta situation a changé.',
    revenus: 'Revenus',
    chargesFixes: 'Charges fixes',
    epargneVisee: 'Épargne visée',
    champLibelle: (nom: string) => `${nom}, en euros`,
    budgetDuMois: (centimes: number) => `Budget du mois${NBSP}: ${formatEuros(centimes)}`,
    budgetNul: `Ton budget du mois doit être supérieur à ${formatEuros(0)}.`,
    confirmerBudget: 'Confirmer mon budget',
    refusBudget: 'Ton budget n’a pas pu être enregistré. Réessaie dans un instant.',
  },

  /**
   * La maison (E8, E2, E6, J4.1) : description de la scène pour le lecteur d'écran.
   * Textes absents de « Textes et ton », proposés au propriétaire dans la demande de fusion.
   */
  maison: {
    /** « Kura, la réserve, novembre 2026 ». */
    piece: (nomPiece: string, mois: string, annee: number) =>
      `${nomPiece}, ${nomDuMois(mois)} ${annee}`,
    /** « L’échelle », « L’échelle, fêlée, réparation : 4 jours sur 7 », « Le daruma, réparé à l’or ». */
    objet: (objet: NomObjet, etat: 'intact' | 'cracked' | 'repaired', jours: number | null) => {
      if (etat === 'repaired')
        return `${debut(objet)}, ${accord(objet, 'réparé', 'réparée', 'réparés', 'réparées')} à l’or`;
      if (etat === 'intact') return debut(objet);
      const fele = `${debut(objet)}, ${accord(objet, 'fêlé', 'fêlée', 'fêlés', 'fêlées')}`;
      return jours === null
        ? fele
        : `${fele}, réparation${NBSP}: ${jours} jour${jours > 1 ? 's' : ''} sur 7`;
    },
    emplacementsLibres: (n: number) =>
      `${n} emplacement${n > 1 ? 's' : ''} libre${n > 1 ? 's' : ''}`,
    /** Niveaux de poussière 0, 1 et 2 (Poussière, Fiche des visuels). */
    poussiere: [
      'La maison est propre',
      'Un voile de poussière',
      'De la poussière, une toile d’araignée et la lumière baissée',
    ] as const,
    /** La scène lue d'un seul tenant. */
    description: (morceaux: readonly string[]) => `${morceaux.join('. ')}.`,
  },

  /**
   * La maison (E8, J4.6, #85) : les pièces de l'année, leurs objets, la réparation en cours.
   * « Réparation : 4 jours sur 7 » vient de la spec ; les autres textes sont absents de « Textes
   * et ton », proposés au propriétaire dans la demande de fusion.
   */
  ecranMaison: {
    titre: 'Ta maison',
    retour: 'Retour',
    retourLibelle: 'Retour à l’accueil',
    album: 'Album',
    albumLibelle: 'Ouvrir l’album des années passées',
    /** « Novembre · Kura, la réserve ». */
    piece: (mois: string, nomPiece: string) => `${majuscule(nomDuMois(mois))} · ${nomPiece}`,
    /** « L’échelle », « Les étagères ». */
    nomObjet: (objet: NomObjet) => debut(objet),
    /** État d'un objet, sous son nom. */
    intact: (objet: NomObjet) => accord(objet, 'Intact', 'Intacte', 'Intacts', 'Intactes'),
    repare: (objet: NomObjet) =>
      `${accord(objet, 'Réparé', 'Réparée', 'Réparés', 'Réparées')} à l’or`,
    /** Fêlure et réparation › Affichage. */
    reparation: (jours: number) => `Réparation${NBSP}: ${jours} jour${jours > 1 ? 's' : ''} sur 7`,
    /** Fêlé, derrière un autre objet dans la file de réparation : sans chiffre. */
    reparationEnAttente: (objet: NomObjet) =>
      accord(
        objet,
        'Fêlé, attend son tour de réparation',
        'Fêlée, attend son tour de réparation',
        'Fêlés, attendent leur tour de réparation',
        'Fêlées, attendent leur tour de réparation',
      ),
    /** Libellé du bouton d'un objet : son nom et son état, lus d'un seul tenant. */
    objetLibelle: (
      objet: NomObjet,
      etat: 'intact' | 'cracked' | 'repaired',
      reparation: { type: 'enCours'; jours: number } | { type: 'enAttente' } | null,
    ) => {
      if (etat === 'intact')
        return `${debut(objet)}, ${accord(objet, 'intact', 'intacte', 'intacts', 'intactes')}`;
      if (etat === 'repaired')
        return `${debut(objet)}, ${accord(objet, 'réparé', 'réparée', 'réparés', 'réparées')} à l’or`;
      const fele = `${debut(objet)}, ${accord(objet, 'fêlé', 'fêlée', 'fêlés', 'fêlées')}`;
      if (reparation?.type === 'enCours')
        return `${fele}, réparation${NBSP}: ${reparation.jours} jour${reparation.jours > 1 ? 's' : ''} sur 7`;
      return `${fele}, ${accord(objet, 'attend son tour', 'attend son tour', 'attendent leur tour', 'attendent leur tour')} de réparation`;
    },
    objetIndice: 'Ouvre sa fiche',
    /** Emplacements libres, signalés discrètement sous la liste. */
    libres: (n: number) =>
      `${n} emplacement${n > 1 ? 's' : ''} libre${n > 1 ? 's' : ''} pour les objets à gagner`,
    enAttenteTitre: 'En attente de leur pièce',
  },

  /**
   * Fiche d'objet (E8, J4.7, #86) : l'histoire suit « Textes et ton › Fiche d'objet ». Titres,
   * phrase d'un objet de base et libellés proposés au propriétaire dans la demande de fusion.
   */
  ficheObjet: {
    retour: 'Retour',
    retourLibelle: 'Retour à ta maison',
    /** Titre de la fiche : « L’échelle », « Le daruma ». */
    titre: (objet: NomObjet) => debut(objet),
    /** Nom japonais lu d'un seul tenant : la transcription, puis l'écriture japonaise. */
    japonaisLibelle: (japonais: { kanji: string; romaji: string }) =>
      `En japonais${NBSP}: ${japonais.romaji}, ${japonais.kanji}`,
    auJapon: 'Au Japon',
    sonHistoire: 'Son histoire',
    /**
     * « Gagné la semaine du 2 novembre. Fêlé le 15, réparé à l’or le 22. » Chaque partie n'apparaît
     * que si elle a eu lieu ; le mois n'est redit que s'il change d'une date à la suivante. Un objet
     * de base dit depuis quand il est là.
     */
    histoire: (
      objet: NomObjet,
      histoire: {
        arrivee: { type: 'gagne'; lundi: string } | { type: 'base'; jour: string };
        felure: string | null;
        reparation: string | null;
      },
    ): string => {
      const { arrivee, felure, reparation } = histoire;
      const debutHistoire =
        arrivee.type === 'gagne'
          ? `${accord(objet, 'Gagné', 'Gagnée', 'Gagnés', 'Gagnées')} la semaine du ${dateDansLeMois(arrivee.lundi, null)}.`
          : `Dans ta maison depuis le ${dateDansLeMois(arrivee.jour, null)}.`;
      if (felure === null) return debutHistoire;
      const precedent = arrivee.type === 'gagne' ? arrivee.lundi : arrivee.jour;
      const fele = `${accord(objet, 'Fêlé', 'Fêlée', 'Fêlés', 'Fêlées')} le ${dateDansLeMois(felure, precedent)}`;
      if (reparation === null) return `${debutHistoire} ${fele}.`;
      const repare = `${accord(objet, 'réparé', 'réparée', 'réparés', 'réparées')} à l’or le ${dateDansLeMois(reparation, felure)}`;
      return `${debutHistoire} ${fele}, ${repare}.`;
    },
  },

  /**
   * Album des années passées (E8, #87). Textes absents de « Textes et ton », proposés au
   * propriétaire dans la demande de fusion.
   */
  album: {
    titre: 'Album',
    retour: 'Retour',
    retourLibelle: 'Fermer l’album',
    /** Album vide : court, sans reproche ; année de la maison en cours. */
    vide: (annee: number) =>
      `Ton album est encore vide. À la nouvelle année, ta maison de ${annee} viendra s’y ranger, telle que tu l’as faite.`,
    /** Une vignette par année passée. */
    vignette: (annee: number) => `${annee}`,
    vignetteLibelle: (annee: number, pieces: number) =>
      `Ta maison de ${annee}, ${pieces} pièce${pieces > 1 ? 's' : ''}`,
    vignetteIndice: 'Affiche ses pièces en grand',
    annee: (annee: number) => `Ta maison de ${annee}`,
    toutesLesAnnees: 'Toutes les années',
    toutesLesAnneesLibelle: 'Revenir à toutes les années de l’album',
    /** « Novembre · Kura, la réserve ». */
    piece: (mois: string, nomPiece: string) => `${majuscule(nomDuMois(mois))} · ${nomPiece}`,
  },

  /**
   * Carnet (E9, #102) : les dépenses passées. Textes absents de « Textes et ton », proposés au
   * propriétaire dans la demande de fusion ; le résultat reprend les mots du récapitulatif (E6).
   */
  carnet: {
    titre: 'Carnet',
    retour: 'Retour',
    retourLibelle: 'Fermer le carnet',
    /** Mois 'AAAA-MM' -> « Novembre 2026 ». */
    mois: (mois: string) => `${majuscule(nomDuMois(mois))} ${mois.slice(0, 4)}`,
    moisPrecedent: '‹',
    moisPrecedentLibelle: (mois: string | null) =>
      mois === null
        ? 'Mois précédent'
        : `Mois précédent${NBSP}: ${nomDuMois(mois)} ${mois.slice(0, 4)}`,
    moisSuivant: '›',
    moisSuivantLibelle: (mois: string | null) =>
      mois === null
        ? 'Mois suivant'
        : `Mois suivant${NBSP}: ${nomDuMois(mois)} ${mois.slice(0, 4)}`,
    /** Le filtre, lu comme un curseur : le mois affiché parmi ceux du carnet. */
    filtreLibelle: (mois: string, rang: number, total: number) =>
      `${nomDuMois(mois)} ${mois.slice(0, 4)}, mois ${rang} sur ${total}`,
    /** Lundi et dimanche 'AAAA-MM-JJ' -> « Semaine du 2 au 8 novembre », « du 30 novembre au 6 décembre ». */
    semaine: (lundi: string, dimanche: string) =>
      `Semaine du ${dateDansLeMois(lundi, lundi.slice(0, 7) === dimanche.slice(0, 7) ? dimanche : null)} au ${dateDansLeMois(dimanche, null)}`,
    /** Semaine coupée au mois affiché (#102) : « Dans ce mois : le 30 novembre », « … : du 1er au 6 décembre ». */
    joursDuMois: (debut: string, fin: string) =>
      debut === fin
        ? `Dans ce mois${NBSP}: le ${dateDansLeMois(debut, null)}`
        : `Dans ce mois${NBSP}: du ${dateDansLeMois(debut, fin)} au ${dateDansLeMois(fin, null)}`,
    semaineOuverte: 'Semaine ouverte',
    tampons: (tampons: number, jours: number) =>
      `${tampons} tampon${tampons > 1 ? 's' : ''} sur ${jours}`,
    depense: (depense: number, enveloppe: number) =>
      `Dépensé${NBSP}: ${formatEuros(depense)} sur ${formatEuros(enveloppe)}`,
    dansEnveloppe: 'Dans ton enveloppe',
    horsEnveloppe: 'Au-delà de ton enveloppe',
    /** Le résultat d'une semaine scellée, lu d'un seul tenant. */
    resultatLibelle: (morceaux: readonly string[]) => `Résultat${NBSP}: ${morceaux.join(', ')}.`,
    parCategorie: 'Par catégorie',
    totalCategorie: (categorie: string, centimes: number) =>
      `${categorie}${NBSP}: ${formatEuros(centimes)}`,
    totalSemaine: (centimes: number) => `Total de la semaine${NBSP}: ${formatEuros(centimes)}`,
    /** Total d'une semaine coupée : il ne porte que sur les jours du mois affiché. */
    totalJours: (centimes: number) => `Total de ces jours${NBSP}: ${formatEuros(centimes)}`,
    aucuneDepense: 'Aucune dépense notée cette semaine.',
    aucuneDepenseJours: 'Aucune dépense notée ces jours-là.',
    /** Jour 'AAAA-MM-JJ' -> « Mercredi 4 novembre ». */
    jour: (jour: string) => majuscule(jourEtDate(jour)),
    totalJour: (centimes: number) => formatEuros(centimes),
    jourLibelle: (jour: string, centimes: number) =>
      `${jourEtDate(jour)}, total${NBSP}: ${formatEuros(centimes)}`,
    montant: (centimes: number) => formatEuros(centimes),
    /** « 12,50 € en Envies, note : cinéma ». */
    depenseLibelle: (centimes: number, categorie: string, note: string) =>
      `${formatEuros(centimes)} en ${categorie}${note === '' ? '' : `, note${NBSP}: ${note}`}`,
  },

  messages: {
    /** « Un daruma entre dans ta maison. », « Des lanternes de papier entrent dans ta maison. » */
    ouvertureCapsule: (objet: NomObjet) =>
      `${majuscule(indefini(objet))} ${accord(objet, 'entre', 'entre', 'entrent', 'entrent')} dans ta maison.`,
    fele: (objet: NomObjet) => `${debut(objet)} ${sEstFele(objet)}.`,
    repare: (objet: NomObjet) =>
      `${debut(objet)} ${accord(objet, 'est réparé', 'est réparée', 'sont réparés', 'sont réparées')} à l’or.`,
    /** Annoncée à la clôture qui complète la réparation (#66). */
    reparation: (objet: NomObjet) =>
      `${accord(objet, 'Réparé', 'Réparée', 'Réparés', 'Réparées')} à l’or, ${avecArticle(objet)} ${accord(objet, 'garde', 'garde', 'gardent', 'gardent')} la trace de cette semaine-là.`,
    poussiereJours: 'La maison prend la poussière. Une clôture suffit à l’aérer.',
    poussiereSemaineIncomplete:
      'Un voile de poussière reste jusqu’à ta prochaine semaine complète.',
    /** Mois 'AAAA-MM' de la pièce et du bilan qui l'ouvrira. */
    objetEnAttente: (moisPiece: string, moisBilan: string) =>
      `Ton objet attend la pièce ${duMois(moisPiece)}${NBSP}: elle s’ouvrira avec le bilan ${duMois(moisBilan)}.`,
    /** Mois 'AAAA-MM' de la pièce et fête du catalogue. */
    nouvellePiece: (mois: string, fete: string) =>
      `La pièce ${duMois(mois)} s’ouvre${NBSP}: c’est le mois ${de(fete)}.`,
    nouvelleAnnee: (annee: number) =>
      `Une nouvelle année commence. Ta maison de ${annee} rejoint l’album, telle que tu l’as faite.`,
    finEssai:
      'Ton mois d’essai se termine. Choisis ta formule : l’abonnement, ou l’appli gratuite avec de la publicité. Tes données restent là dans les deux cas.',
  },

  /** Carte de première fois (E12) : titre (le moment, tel que la spec le nomme), texte et fermeture. */
  carteExplication: {
    titres: {
      first_expense: 'Première dépense',
      first_stamp: 'Premier tampon',
      first_catch_up: 'Premier jour à rattraper',
      first_capsule: 'Première capsule',
      first_dust: 'Première poussière',
      first_crack: 'Première fêlure',
      first_repair: 'Première réparation',
      first_month_review: 'Premier bilan du mois',
      new_room: 'Nouvelle pièce',
    },
    fermer: 'Fermer',
    fermerLibelle: (titre: string) => `Fermer l’explication «${NBSP}${titre}${NBSP}»`,
    /** Ouvre Comprendre (E12) à la fiche de la carte (#106). */
    enSavoirPlus: 'En savoir plus',
    enSavoirPlusLibelle: (titre: string) => `En savoir plus sur «${NBSP}${titre}${NBSP}»`,
    enSavoirPlusIndice: 'Ouvre Comprendre',
  },

  /**
   * Comprendre (E12, #106) : les fiches reprennent les textes de « Messages d'explication ». Titres
   * des fiches tirés de la liste de E12 ; les autres textes, absents de « Textes et ton », sont
   * proposés au propriétaire dans la demande de fusion.
   */
  /** Réglages (E10, J5.6) : budget du mois, rappel du soir, données, à propos. */
  reglages: {
    titre: 'Réglages',
    retour: 'Retour',
    retourLibelle: 'Fermer les réglages',
    budget: {
      titre: 'Budget du mois',
      revenus: 'Mes revenus du mois',
      epargne: 'Mon épargne visée',
      champLibelle: (nom: string) => `${nom}, en euros`,
      chargesFixes: (centimes: number) => `Charges fixes du mois${NBSP}: ${formatEuros(centimes)}`,
      budgetMois: (centimes: number) => `Budget du mois${NBSP}: ${formatEuros(centimes)}`,
      budgetPositif: `Ton budget du mois doit être supérieur à ${formatEuros(0)} pour l’enregistrer.`,
      /** Lundi 'AAAA-MM-JJ' à partir duquel l'enveloppe change. */
      quand: (lundi: string) =>
        `Un changement s’applique à ton enveloppe à partir du ${jourEtDate(lundi)}. La semaine en cours ne change pas.`,
      enregistrer: 'Enregistrer mes revenus et mon épargne',
      enregistre: (lundi: string) => `C’est noté. Ton enveloppe changera le ${jourEtDate(lundi)}.`,
      refus: 'Ton budget n’a pas pu être enregistré. Vérifie les montants.',
    },
    charges: {
      titre: 'Mes dépenses récurrentes',
      aide: `Loyer, abonnements, assurances${NBSP}: elles forment tes charges fixes. Elles ne comptent ni dans ton enveloppe ni dans tes dépenses de la semaine.`,
      aucune: 'Aucune dépense récurrente pour l’instant.',
      ajouter: 'Ajouter une dépense récurrente',
      /** « Chaque mois, le 15 », « Chaque semaine, le lundi ». */
      echeance: (frequence: 'monthly' | 'weekly', jour: number) =>
        frequence === 'monthly'
          ? `Chaque mois, le ${jour === 1 ? '1er' : jour}`
          : `Chaque semaine, le ${JOURS[jour % 7]}`,
      ligneLibelle: (libelle: string, centimes: number, echeance: string) =>
        `${libelle}, ${formatEuros(centimes)}, ${echeance.toLowerCase()}`,
      ligneIndice: 'Ouvre sa fiche pour la modifier ou l’arrêter',
      nouvelle: 'Nouvelle dépense récurrente',
      modifier: 'Modifier la dépense récurrente',
      libelle: 'Libellé',
      libelleExemple: 'Loyer',
      montant: 'Montant de chaque échéance',
      frequence: 'Fréquence',
      mensuelle: 'Chaque mois',
      hebdomadaire: 'Chaque semaine',
      jourLibelle: (echeance: string) => `Échéance${NBSP}: ${echeance.toLowerCase()}`,
      jourIndice: 'Balaie vers le haut ou vers le bas pour changer le jour.',
      jourPrecedent: 'Jour précédent',
      jourSuivant: 'Jour suivant',
      finDeMois: 'Les mois plus courts, l’échéance tombe le dernier jour du mois.',
      enregistrer: 'Enregistrer',
      enregistrerLibelle: 'Enregistrer la dépense récurrente',
      annuler: 'Annuler',
      annulerLibelle: 'Annuler, sans rien changer',
      arreter: 'Arrêter cette dépense',
      arreterLibelle: (libelle: string) => `Arrêter ${libelle} à partir d’aujourd’hui`,
      arreterAide: 'Elle ne compte plus à partir d’aujourd’hui et garde son historique.',
      refus: `Cette dépense récurrente n’a pas pu être enregistrée. Vérifie le libellé et le montant${NBSP}; ton budget du mois doit rester supérieur à ${formatEuros(0)}.`,
    },
    rappel: {
      titre: 'Rappel du soir',
      texte:
        'Chaque soir, à l’heure choisie, un rappel t’invite à clôturer ta journée, si ce n’est pas déjà fait. Une notification par jour, au plus.',
      active: 'Rappel activé',
      activeLibelle: 'Rappel du soir activé',
      refuse: `Les notifications sont désactivées pour Kakeibo${NBSP}: ton rappel ne peut pas s’afficher. Pour les activer, ouvre les réglages de ton téléphone, puis Notifications. L’appli fonctionne aussi sans.`,
      ouvrirReglages: 'Ouvrir les réglages du téléphone',
    },
    donnees: {
      titre: 'Données',
      texte: 'Tes données restent sur ce téléphone, et nulle part ailleurs.',
      effacer: 'Tout effacer',
      effacerLibelle: `Tout effacer${NBSP}: dépenses, tampons, maison et budget`,
      confirmation1: `Tout effacer${NBSP}? Tes dépenses, tes tampons, ta maison et ton budget seront supprimés de ce téléphone.`,
      continuer: 'Continuer',
      continuerLibelle: 'Continuer vers la dernière confirmation',
      annuler: 'Annuler',
      annulerLibelle: 'Annuler, ne rien effacer',
      confirmation2: `Dernière confirmation${NBSP}: une fois effacées, tes données ne pourront pas être retrouvées. L’appli repartira de la bienvenue.`,
      confirmer: 'Oui, tout effacer',
      confirmerLibelle: 'Oui, tout effacer définitivement',
    },
    /**
     * À propos : la méthode, la confidentialité et les mentions. Textes légaux, en brouillon :
     * à valider par le propriétaire (#105). Le contact attend sa réponse.
     */
    aPropos: {
      titre: 'À propos',
      methode: `Le kakeibo est une méthode japonaise de suivi du budget${NBSP}: tu notes toi-même chaque dépense, tu clôtures chaque soir et tu fais le bilan chaque semaine et chaque mois.`,
      comprendre: 'Comprendre',
      comprendreLibelle: `Comprendre${NBSP}: la méthode kakeibo et les règles de la maison`,
      confidentialiteTitre: 'Confidentialité',
      confidentialite: `Tes données restent sur ton téléphone${NBSP}: pas de compte, pas de serveur, aucun traceur. L’appli n’envoie rien hors de ton téléphone.`,
      mentionsTitre: 'Mentions',
      mentions: 'Kakeibo est un outil de suivi personnel. Il ne donne pas de conseil financier.',
    },
  },

  comprendre: {
    titre: 'Comprendre',
    retour: 'Retour',
    retourLibelle: 'Fermer Comprendre',
    toutesLesFiches: 'Toutes les fiches',
    toutesLesFichesLibelle: 'Revenir à toutes les fiches de Comprendre',
    ficheIndice: 'Ouvre la fiche',
    fiches: {
      methode: 'La méthode kakeibo',
      categories: 'Les quatre catégories',
      questions: 'Les quatre questions',
      maison: 'Les règles de la maison',
      kintsugi: 'Le kintsugi',
      gashapon: 'Les gashapon',
      fetes: 'Les fêtes de chaque mois',
      objets: 'Tes objets',
    },
    /** Mois 1 à 12 et nom de la pièce : « Novembre · Kura, la réserve ». */
    piece: (mois: number, nomPiece: string) => `${majuscule(MOIS[mois - 1])} · ${nomPiece}`,
    /** Un objet de la maison, à toucher pour ouvrir sa fiche (J4.7) : « L’échelle ». */
    objet: (objet: NomObjet) => debut(objet),
    objetIndice: 'Ouvre sa fiche',
    objetsVide: 'Tes objets apparaîtront ici dès qu’ils entreront dans ta maison.',
  },

  explications: {
    bienvenueMethode:
      'Le kakeibo, le “livre de comptes du foyer”, est né au Japon en 1904 : Motoko Hani, première femme journaliste du pays, l’a imaginé pour tenir ses comptes à la main. On n’y cherche pas à tout contrôler, mais à prendre conscience de ce qu’on dépense.',
    bienvenueCategories:
      'Chaque dépense va dans l’une des quatre catégories : Essentiel, Envies, Culture, Imprévus. Semaine après semaine, tu verras où va ton argent.',
    bienvenueMois:
      'Ton budget, c’est ce qui reste une fois payées tes charges fixes et mise de côté ton épargne. Il se partage en enveloppes, une par semaine.',
    premiereDepense:
      'Noter soi-même chaque dépense, c’est le cœur du kakeibo : ce petit geste suffit pour y penser à deux fois.',
    premierTampon: `Chaque soir, tu clôtures ta journée${NBSP}: tu confirmes avoir tout noté, un tampon se pose et un jeton tombe dans la machine. Au Japon, les enfants font tamponner une carte chaque matin des vacances d’été, à la gymnastique de la radio (rajio taisō).`,
    /** Texte de la révision 847 : la tirette (#66). */
    premiereCapsule: `Avec tous tes jetons de la semaine, tu tires la tirette, comme dans les gashapon, ces distributeurs de petits jouets qu’on trouve partout au Japon. Ici, pas de hasard${NBSP}: chaque semaine complète apporte l’objet suivant de la pièce du mois.`,
    premierJourARattraper:
      'Tu as oublié de clôturer un soir ? Tu peux rattraper ce jour jusqu’au lundi midi qui suit sa semaine.',
    premierePoussiere:
      'Quand des jours restent sans tampon, la poussière se pose. Elle n’abîme jamais rien et s’envole avec une semaine complète.',
    premiereFelure:
      'Au Japon, on répare les bols cassés avec une laque saupoudrée d’or : c’est le kintsugi, l’art de montrer ses réparations plutôt que de les cacher. Ici, 7 jours de clôture d’affilée réparent l’objet à l’or, et il ne se fêlera plus.',
    premiereReparation:
      'Le voilà réparé à l’or, plus précieux qu’avant : il garde la trace de cette semaine-là.',
    premierBilanDuMois:
      'Chaque fin de mois, le kakeibo pose quatre questions : combien avais-je, combien voulais-je mettre de côté, combien ai-je dépensé, et comment faire mieux ? La quatrième devient ta résolution du mois.',
    nouvellePiece:
      'Chaque mois ouvre une pièce de la maison, décorée pour sa fête ou sa saison. Ses objets se gagnent semaine après semaine.',
    nouvelleAnnee:
      'Au Japon, on fait le grand ménage de fin d’année (ōsōji) pour accueillir l’an neuf dans une maison propre. Ta maison repart de zéro ; celle de l’an passé rejoint l’album, telle que tu l’as faite.',
  },
} as const;
