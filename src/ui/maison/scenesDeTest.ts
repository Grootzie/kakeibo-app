// Scènes de test de la maison (J4.4) : la pièce de novembre, telle que J4.1 la rend.
import type { HouseScene, SceneItem } from '../../domain/maison';

export const objetScene = (
  itemId: string,
  source: SceneItem['source'],
  rank: number,
  state: SceneItem['state'] = 'intact',
): SceneItem => ({ itemId, source, rank, state, repairDays: null });

/** Kura, novembre 2026 : trois objets de base, le kumade gagné, trois emplacements libres. */
export const sceneNovembre = (over: Partial<HouseScene> = {}): HouseScene => ({
  year: 2026,
  month: '2026-11',
  room: 'room-11',
  items: [
    objetScene('etageres', 'base', 1),
    objetScene('coffre-nagamochi', 'base', 2),
    objetScene('echelle', 'base', 3),
    objetScene('rateau-porte-bonheur-kumade', 'weekly', 1),
  ],
  freeSlots: [
    { rank: 2, itemId: 'chat-porte-bonheur' },
    { rank: 3, itemId: 'boulier-soroban' },
    { rank: 4, itemId: 'sucres-d-orge-chitose-ame' },
  ],
  dust: 0,
  ...over,
});
