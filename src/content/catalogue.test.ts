// Catalogue (src/content) : chaque objet a son nom avec son article et son genre (Modèle de
// données), pour accorder les phrases : « La lanterne s'est fêlée », « Un daruma entre… » (#62).
import catalogueJson from './catalogue.json';
import type { Catalog } from '../domain/objets';

const catalogue = catalogueJson as Catalog;
const article = (id: string) => {
  const item = catalogue.items.find((i) => i.id === id);
  return item && [item.article, item.gender];
};

describe('catalogue : article et genre des objets', () => {
  it('donne à chaque objet un article et un genre', () => {
    for (const item of catalogue.items) {
      expect(['le', 'la', "l'", 'les']).toContain(item.article);
      expect(['m', 'f']).toContain(item.gender);
    }
  });

  it('élide devant une voyelle, jamais au pluriel', () => {
    for (const item of catalogue.items) {
      const voyelle = /^[aeiouyéèêâîôûœ]/i.test(item.name);
      if (item.article === 'les') continue;
      expect([item.name, item.article === "l'"]).toEqual([item.name, voyelle]);
    }
  });

  it('accorde le ou la avec le genre', () => {
    for (const item of catalogue.items) {
      if (item.article === 'le') expect([item.name, item.gender]).toEqual([item.name, 'm']);
      if (item.article === 'la') expect([item.name, item.gender]).toEqual([item.name, 'f']);
    }
  });

  it('nomme quelques objets comme la spec', () => {
    expect(article('daruma')).toEqual(['le', 'm']);
    expect(article('lanterne-de-pierre')).toEqual(['la', 'f']);
    expect(article('echelle')).toEqual(["l'", 'f']);
    expect(article('eventail-uchiwa')).toEqual(["l'", 'm']);
    expect(article('etageres')).toEqual(['les', 'f']);
    expect(article('kakis-seches')).toEqual(['les', 'm']);
    // Un ensemble nommé par deux noms se dit au singulier : « Le seau et tabouret en bois ».
    expect(article('cheval-et-vache-d-obon')).toEqual(['le', 'm']);
  });
});
