// Store de l'appli : la vraie base du téléphone, le catalogue livré et l'horloge de l'appli.
import { useStore } from 'zustand';

import catalogueJson from '../content/catalogue.json';
import { openDb } from '../data/expoDb';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import type { Catalog } from '../domain/objets';
import { horloge } from './clock';
import { type EtatKakeibo, createKakeiboStore } from './store';

/** Identifiant local unique : jamais envoyé hors du téléphone. */
function nouvelId(): string {
  const hasard = Math.random().toString(36).slice(2, 10);
  return `${horloge.now().getTime().toString(36)}-${hasard}`;
}

export const kakeibo = createKakeiboStore({
  depots: async () => {
    const db = await openDb();
    await migrate(db);
    return createRepositories(db);
  },
  catalogue: catalogueJson as Catalog,
  horloge,
  nouvelId,
});

/** Lecture de l'état par les écrans, avec un sélecteur. */
export function useKakeibo<T>(selecteur: (etat: EtatKakeibo) => T): T {
  return useStore(kakeibo, selecteur);
}
