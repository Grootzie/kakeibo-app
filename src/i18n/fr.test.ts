import { fr, formatEuros } from './fr';

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((v) => collectStrings(v, out));
  }
  return out;
}

describe('fr.ts', () => {
  const textes = collectStrings(fr);

  it('contient des textes', () => {
    expect(textes.length).toBeGreaterThan(30);
  });

  it('place une espace insécable avant ? ! : ;', () => {
    textes.forEach((t) => expect(t).not.toMatch(/ [?!:;]/));
  });

  it("place des espaces insécables à l'intérieur des guillemets « »", () => {
    textes.forEach((t) => {
      expect(t).not.toMatch(/« (?! )/);
      expect(t).not.toMatch(/ »/);
    });
  });

  it('utilise des guillemets anglais pour la citation imbriquée de la carte méthode', () => {
    expect(fr.explications.bienvenueMethode).toContain('le “livre de comptes du foyer”');
  });

  it('ne contient ni emoji ni série de points d’exclamation', () => {
    textes.forEach((t) => {
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/!.*!/);
    });
  });

  it('tutoie', () => {
    textes.forEach((t) => expect(t).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i));
  });

  it('nomme les quatre catégories avec une icône', () => {
    expect(fr.categories.essentiel.nom).toBe('Essentiel');
    expect(fr.categories.envies.nom).toBe('Envies');
    expect(fr.categories.culture.nom).toBe('Culture');
    expect(fr.categories.imprevus.nom).toBe('Imprévus');
  });

  it('formate les montants à la française', () => {
    expect(formatEuros(6300)).toBe('63 €');
    expect(formatEuros(6350)).toBe('63,50 €');
    expect(formatEuros(0)).toBe('0 €');
    expect(formatEuros(-1200)).toBe('−12 €');
  });

  it('compose les messages de l’accueil', () => {
    expect(fr.accueil.reste(6300, 'dimanche')).toBe('Il te reste 63 € jusqu’à dimanche');
    expect(fr.accueil.depassement(1200)).toBe('Tu as dépassé de 12 € cette semaine');
  });

  it('accorde les phrases avec le genre de l’objet', () => {
    const lanterne = { nom: 'lanterne', article: 'la', genre: 'f' } as const;
    const daruma = { nom: 'daruma', article: 'le', genre: 'm' } as const;
    expect(fr.messages.fele(lanterne)).toBe('La lanterne s’est fêlée.');
    expect(fr.messages.fele(daruma)).toBe('Le daruma s’est fêlé.');
    expect(fr.messages.repare(daruma)).toBe('Le daruma est réparé à l’or.');
    expect(fr.messages.repare(lanterne)).toBe('La lanterne est réparée à l’or.');
  });
});

describe('accueil (E2, #43)', () => {
  it('écrit la date du jour en français', () => {
    expect(fr.accueil.date('2026-11-06')).toBe('vendredi 6\u00a0novembre');
    expect(fr.accueil.date('2026-03-01')).toBe('dimanche 1er\u00a0mars');
  });

  it('annonce le reste ou le dépassement au format français', () => {
    expect(fr.accueil.reste(6300, 'dimanche')).toBe('Il te reste 63\u00a0€ jusqu’à dimanche');
    expect(fr.accueil.depassement(1200)).toBe('Tu as dépassé de 12\u00a0€ cette semaine');
  });

  it('annonce chaque case au lecteur d’écran', () => {
    expect(fr.accueil.caseLibelle('2026-11-04', 'cloturee')).toBe('mercredi, clôturé');
    expect(fr.accueil.caseLibelle('2026-11-04', 'rattrapable')).toBe('mercredi, à rattraper');
    expect(fr.accueil.caseLibelle('2026-11-06', 'a_cloturer')).toBe(
      'vendredi, à clôturer aujourd’hui',
    );
    expect(fr.accueil.caseLibelle('2026-11-02', 'hors_decompte')).toBe('lundi, hors décompte');
    expect(fr.accueil.caseLibelle('2026-11-08', 'a_venir')).toBe('dimanche, à venir');
  });

  it('nomme les deux boutons et le bandeau', () => {
    expect(fr.accueil.cloturerJournee).toBe('Clôturer ma journée');
    expect(fr.accueil.journeeCloturee).toBe('Journée clôturée');
    expect(fr.accueil.bandeauRattraper('2026-11-04')).toBe(
      'Tu peux encore rattraper mercredi 4\u00a0novembre.',
    );
  });
});

describe('bilan du mois (E7, #64)', () => {
  const N = '\u00a0';

  it('annonce la nouvelle pièce avec le texte de la spec', () => {
    expect(fr.messages.nouvellePiece('2027-03', 'Hinamatsuri, la fête des filles')).toBe(
      `La pièce de mars s’ouvre${N}: c’est le mois de Hinamatsuri, la fête des filles.`,
    );
  });

  it('élide « de » devant une voyelle et le contracte devant « les »', () => {
    expect(fr.messages.nouvellePiece('2027-04', 'Hanami, les cerisiers en fleur')).toBe(
      `La pièce d’avril s’ouvre${N}: c’est le mois de Hanami, les cerisiers en fleur.`,
    );
    expect(fr.messages.nouvellePiece('2027-08', 'Obon et les nuits d’été')).toBe(
      `La pièce d’août s’ouvre${N}: c’est le mois d’Obon et les nuits d’été.`,
    );
    expect(fr.messages.nouvellePiece('2027-10', 'Les récoltes d’automne')).toBe(
      `La pièce d’octobre s’ouvre${N}: c’est le mois des récoltes d’automne.`,
    );
    expect(fr.messages.nouvellePiece('2026-12', 'Ōmisoka, le réveillon')).toBe(
      `La pièce de décembre s’ouvre${N}: c’est le mois d’Ōmisoka, le réveillon.`,
    );
    expect(fr.accueil.bandeauBilanMois('2027-04')).toBe('Le bilan d’avril est prêt.');
    expect(fr.bilan.titreMois('2027-10')).toBe('Bilan d’octobre');
    expect(fr.messages.objetEnAttente('2027-08', '2027-07')).toBe(
      `Ton objet attend la pièce d’août${N}: elle s’ouvrira avec le bilan de juillet.`,
    );
    expect(fr.messages.objetEnAttente('2026-12', '2026-11')).toBe(
      `Ton objet attend la pièce de décembre${N}: elle s’ouvrira avec le bilan de novembre.`,
    );
  });

  it('pose les quatre questions et chiffre les réponses à la française', () => {
    expect(fr.bilanMois.q1).toBe('Ce que j’avais');
    expect(fr.bilanMois.q2).toBe('Ce que je voulais mettre de côté');
    expect(fr.bilanMois.q3).toBe('Ce que j’ai dépensé');
    expect(fr.bilanMois.epargne).toBe('Ce que j’ai vraiment épargné');
    expect(fr.bilanMois.q4).toBe(`Comment puis-je faire mieux${N}?`);
    expect(fr.bilanMois.ligne('Ce que j’avais', 90000)).toBe(`Ce que j’avais${N}: 900${N}€`);
    expect(fr.bilanMois.ligne('Ce que j’ai vraiment épargné', -6250)).toBe(
      `Ce que j’ai vraiment épargné${N}: −62,50${N}€`,
    );
    expect(fr.bilanMois.compteur(12)).toBe('12/140');
  });

  it('ne fait aucun reproche quand l’objectif n’est pas atteint', () => {
    expect(fr.bilanMois.objectifManque).not.toMatch(/dommage|hélas|malheureusement|trop|échec/i);
  });
});

describe('récapitulatif après une longue absence (E6, #63)', () => {
  const N = '\u00a0';
  const r = fr.recapitulatif;

  it('nomme chaque semaine par son lundi', () => {
    expect(r.semaine('2026-11-02')).toBe(`Semaine du 2${N}novembre`);
    expect(r.semaine('2027-03-01')).toBe(`Semaine du 1er${N}mars`);
  });

  it('compte les tampons sur les jours décomptés, au singulier jusqu’à 1', () => {
    expect(r.tampons(7, 7)).toBe('7 tampons sur 7');
    expect(r.tampons(1, 5)).toBe('1 tampon sur 5');
    expect(r.tampons(0, 7)).toBe('0 tampon sur 7');
  });

  it('dit le résultat de chaque semaine avec le vocabulaire fixe', () => {
    expect(r.dansEnveloppe).toBe('Dans ton enveloppe');
    expect(r.horsEnveloppe).toBe('Au-delà de ton enveloppe');
    expect(r.objetGagne('chat porte-bonheur')).toBe(`Objet gagné${N}: chat porte-bonheur`);
    expect(r.poussiere).toBe('Pas de capsule, un peu de poussière');
    expect(r.objetFele('échelle')).toBe(`Objet fêlé${N}: échelle`);
  });

  it('lit une semaine d’un seul tenant, phrase après phrase', () => {
    expect(r.ligneLibelle(['Semaine du 2 novembre', '7 tampons sur 7', 'Dans ton enveloppe'])).toBe(
      'Semaine du 2 novembre. 7 tampons sur 7. Dans ton enveloppe.',
    );
  });

  it('reprend « Réparation : x jours sur 7 » pour la file de réparation', () => {
    expect(r.reparationEnCours('échelle', 0)).toBe(`Réparation${N}: 0 jour sur 7 (échelle)`);
    expect(r.reparationEnCours('échelle', 4)).toBe(`Réparation${N}: 4 jours sur 7 (échelle)`);
    expect(r.reparationEnsuite('chat porte-bonheur')).toBe(
      `À réparer ensuite${N}: chat porte-bonheur`,
    );
    expect(r.reparationAucune).toBe('Aucun objet à réparer.');
  });

  it('constate et encourage, sans reproche', () => {
    const tous = collectStrings(r);
    tous.forEach((t) =>
      expect(t).not.toMatch(/dommage|hélas|malheureusement|trop|échec|oublié|raté|absen/i),
    );
    expect(r.conclusion).toBe(`Rien n’est perdu${N}: une clôture ce soir, et tout repart.`);
  });
});
