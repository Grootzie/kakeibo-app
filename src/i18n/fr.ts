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
    carnetLibelle: 'Carnet',
    reglages: 'Réglages',
    reglagesLibelle: 'Réglages',
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
    /** Dessin provisoire de l'objet, en attendant les visuels (et la maison, J4). */
    objetLibelle: (objet: NomObjet) => `${debut(objet)}, dessin provisoire`,
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

  messages: {
    /** « Un daruma entre dans ta maison. », « Des lanternes de papier entrent dans ta maison. » */
    ouvertureCapsule: (objet: NomObjet) =>
      `${majuscule(indefini(objet))} ${accord(objet, 'entre', 'entre', 'entrent', 'entrent')} dans ta maison.`,
    fele: (objet: NomObjet) => `${debut(objet)} ${sEstFele(objet)}.`,
    repare: (objet: NomObjet) =>
      `${debut(objet)} ${accord(objet, 'est réparé', 'est réparée', 'sont réparés', 'sont réparées')} à l’or.`,
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
    },
    fermer: 'Fermer',
    fermerLibelle: (titre: string) => `Fermer l’explication «${NBSP}${titre}${NBSP}»`,
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
    premierTampon:
      'Chaque soir, tu clôtures ta journée : tu confirmes avoir tout noté, et un tampon se pose. Au Japon, les enfants font tamponner une carte chaque matin des vacances d’été, à la gymnastique de la radio (rajio taisō).',
    premiereCapsule:
      'Tous tes tampons de la semaine : une capsule tombe, comme dans les gashapon, ces distributeurs de petits jouets qu’on trouve partout au Japon. Ici, pas de hasard : chaque semaine complète apporte l’objet suivant de la pièce du mois.',
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
