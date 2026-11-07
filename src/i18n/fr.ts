// Tous les textes visibles de l'appli (voir « Textes et ton » dans docs/spec.md).
// Espaces insécables : U+00A0 avant ? ! : ; et à l'intérieur des guillemets « ».

import { MAX_AMOUNT, MIN_AMOUNT, NOTE_MAX_LENGTH } from '../domain/depense';

const NBSP = ' ';

export type Genre = 'm' | 'f';

/** Nom d'objet tel que le donne le catalogue, avec article et genre. */
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
  const texte = avecArticle(objet);
  return `${texte[0].toUpperCase()}${texte.slice(1)}`;
}

function avecArticle(objet: NomObjet): string {
  const article = objet.article === "l'" ? 'l’' : `${objet.article} `;
  return `${article}${objet.nom}`;
}

function accord(objet: NomObjet, masculin: string, feminin: string): string {
  return objet.genre === 'f' ? feminin : masculin;
}

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
  },

  vocabulaire: {
    noter: 'Noter',
    cloturer: 'Clôturer',
    tampon: 'Tampon',
    enveloppe: 'Enveloppe',
    bilan: 'Bilan',
    resolution: 'Résolution',
    capsule: 'Capsule',
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
    toutTamponsDansBudget:
      'Tous tes tampons, et dans ton enveloppe : une capsule tombe de la machine.',
    toutTamponsHorsBudget: (objet: NomObjet) =>
      `Tu as tout noté, c’est l’essentiel${NBSP}: ta capsule est là. ${debut(objet)} ${accord(objet, 's’est fêlé', 's’est fêlée')}${NBSP}; 7 jours de clôture d’affilée, et ${accord(objet, 'il sera réparé', 'elle sera réparée')} à l’or.`,
    manqueDansBudget:
      'Il manque des tampons cette semaine, alors pas de capsule. Un peu de poussière s’est posée ; une semaine complète, et elle s’envole.',
    manqueHorsBudget: (objet: NomObjet) =>
      `Pas de capsule cette semaine, et ${avecArticle(objet)} ${accord(objet, 's’est fêlé', 's’est fêlée')}. Rien n’est perdu${NBSP}: 7 jours de clôture d’affilée, et ${accord(objet, 'il sera réparé', 'elle sera réparée')} à l’or.`,
  },

  messages: {
    ouvertureCapsule: (objet: NomObjet & { indefini: string }) =>
      `${objet.indefini} ${objet.nom} entre dans ta maison.`,
    fele: (objet: NomObjet) => `${debut(objet)} ${accord(objet, 's’est fêlé', 's’est fêlée')}.`,
    repare: (objet: NomObjet) =>
      `${debut(objet)} est ${accord(objet, 'réparé', 'réparée')} à l’or.`,
    reparation: (objet: NomObjet) =>
      `${accord(objet, 'Réparé', 'Réparée')} à l’or, ${avecArticle(objet)} garde la trace de cette semaine-là.`,
    poussiereJours: 'La maison prend la poussière. Une clôture suffit à l’aérer.',
    poussiereSemaineIncomplete:
      'Un voile de poussière reste jusqu’à ta prochaine semaine complète.',
    objetEnAttente: (piece: string, moisBilan: string) =>
      `Ton objet attend la pièce de ${piece}${NBSP}: elle s’ouvrira avec le bilan de ${moisBilan}.`,
    nouvellePiece: (piece: string, fete: string) =>
      `La pièce de ${piece} s’ouvre${NBSP}: c’est le mois de ${fete}.`,
    nouvelleAnnee: (annee: number) =>
      `Une nouvelle année commence. Ta maison de ${annee} rejoint l’album, telle que tu l’as faite.`,
    finEssai:
      'Ton mois d’essai se termine. Choisis ta formule : l’abonnement, ou l’appli gratuite avec de la publicité. Tes données restent là dans les deux cas.',
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
