// Catalogue complet (J4.2) : explication de chaque pièce ; nom japonais, explication culturelle et
// trois visuels de chaque objet (Modèle de données › Catalogue ; Direction artistique › Contenu de
// la V1 ; Textes et ton).
import { readFileSync } from 'fs';
import { join } from 'path';
import { catalogue, itemVisualId } from './catalogue';

const NBSP = ' ';

/** Typographie de l'appli : apostrophe courbe, espaces insécables avant : ; ? ! et dans « ». */
const typographie = (s: string): string =>
  s
    .replace(/'/g, '’')
    .replace(/ ([:;?!»])/g, `${NBSP}$1`)
    .replace(/« /g, `«${NBSP}`);

/** Nombre de phrases : un point, un point d'interrogation ou d'exclamation suivi d'un blanc ou de la fin. */
const phrases = (s: string): number => (s.match(/[.?!…](?=\s|$)/g) ?? []).length;

const textes = [
  ...catalogue.rooms.map((r) => ({ id: r.id, texte: r.explanation })),
  ...catalogue.items.map((i) => ({ id: i.id, texte: i.explanation })),
];

describe('catalogue complet : champs de chaque entrée', () => {
  it('compte 12 pièces, 36 objets de base et 59 objets à gagner', () => {
    expect(catalogue.rooms).toHaveLength(12);
    expect(catalogue.items.filter((i) => i.source === 'base')).toHaveLength(36);
    expect(catalogue.items.filter((i) => i.source === 'weekly')).toHaveLength(59);
  });

  it('donne une explication à chaque pièce', () => {
    for (const room of catalogue.rooms) {
      expect([room.id, typeof room.explanation]).toEqual([room.id, 'string']);
      expect([room.id, room.explanation.trim().length > 0]).toEqual([room.id, true]);
    }
  });

  it('donne à chaque objet son nom japonais : kanji et transcription', () => {
    const japonais = /[぀-ヿ㐀-鿿]/;
    const hepburn = /^[a-zāēīōū]+(?:[ -][a-zāēīōū]+)*$/;
    for (const item of catalogue.items) {
      expect([item.id, japonais.test(item.japanese?.kanji ?? '')]).toEqual([item.id, true]);
      expect([item.id, /[A-Za-z]/.test(item.japanese.kanji)]).toEqual([item.id, false]);
      expect([item.id, hepburn.test(item.japanese?.romaji ?? '')]).toEqual([item.id, true]);
    }
  });

  it('donne à chaque objet une explication culturelle', () => {
    for (const item of catalogue.items) {
      expect([item.id, typeof item.explanation]).toEqual([item.id, 'string']);
      expect([item.id, item.explanation.trim().length > 0]).toEqual([item.id, true]);
    }
  });

  it('donne à chaque objet ses trois visuels : base, fêlure et or, sans doublon', () => {
    const vus = new Set<string>();
    for (const item of catalogue.items) {
      expect([item.id, item.visuals]).toEqual([
        item.id,
        {
          base: itemVisualId(item.id, 'base'),
          crack: itemVisualId(item.id, 'crack'),
          gold: itemVisualId(item.id, 'gold'),
        },
      ]);
      for (const v of Object.values(item.visuals)) {
        expect([item.id, vus.has(v)]).toEqual([item.id, false]);
        vus.add(v);
      }
    }
    expect(vus.size).toBe(95 * 3);
  });
});

describe('catalogue complet : textes', () => {
  it('écrit chaque explication en deux phrases au plus, terminées par un point', () => {
    for (const { id, texte } of textes) {
      const n = phrases(texte);
      expect([id, n >= 1 && n <= 2]).toEqual([id, true]);
      expect([id, /[.?!…]$/.test(texte)]).toEqual([id, true]);
    }
  });

  it('place les espaces insécables et l’apostrophe courbe de « Textes et ton »', () => {
    for (const { id, texte } of textes) {
      expect([id, texte]).toEqual([id, typographie(texte)]);
      expect([id, /[  ]{2}|\s$|^\s/.test(texte)]).toEqual([id, false]);
      expect([id, /[:;?!»]/.test(texte.replace(/ [:;?!»]/g, ''))]).toEqual([id, false]);
      expect([id, /«(?! )/.test(texte)]).toEqual([id, false]);
    }
  });

  it('ne contient ni emoji, ni point d’exclamation, ni vouvoiement', () => {
    for (const { id, texte } of textes) {
      expect([id, /\p{Extended_Pictographic}/u.test(texte)]).toEqual([id, false]);
      expect([id, texte.includes('!')]).toEqual([id, false]);
      expect([id, /\b(vous|votre|vos)\b/i.test(texte)]).toEqual([id, false]);
    }
  });

  it('reprend mot pour mot les huit exemples de la spec', () => {
    const spec = readFileSync(join(__dirname, '../../docs/spec.md'), 'utf8');
    const debut = spec.indexOf('**Explications :**');
    const fin = spec.indexOf('\n\n', spec.indexOf('\n- ', debut));
    const exemples = [...spec.slice(debut, fin).matchAll(/^- \*\*(.+?) :\*\* « (.+) »$/gm)];
    const ids: Record<string, string> = {
      Kadomatsu: 'kadomatsu',
      Daruma: 'daruma',
      'Teru teru bōzu': 'teru-teru-bozu',
      'Kayari-buta': 'porte-encens-kayari-buta',
      "Cheval et vache d'Obon": 'cheval-et-vache-d-obon',
      'Lapin de la lune': 'lapin-de-la-lune',
      Kumade: 'rateau-porte-bonheur-kumade',
      'Boulier soroban': 'boulier-soroban',
    };
    expect(exemples.map((e) => e[1])).toEqual(Object.keys(ids));
    for (const [, nom, texte] of exemples) {
      const item = catalogue.items.find((i) => i.id === ids[nom]);
      expect([nom, item?.explanation]).toEqual([nom, typographie(texte)]);
    }
  });
});
