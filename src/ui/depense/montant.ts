// Lecture du montant tapé au pavé numérique (E3). Le domaine vérifie ensuite les bornes.
import type { Cents } from '../../domain/budget';

const FORME = /^(\d*)(?:[.,](\d{0,2}))?$/;

/** « 12,50 » ou « 12.5 » -> 1250 centimes ; null si le texte n'est pas un montant. */
export function lireMontant(texte: string): Cents | null {
  const m = FORME.exec(texte.replace(/\s/g, ''));
  if (m === null) return null;
  const [, entiers, decimales = ''] = m;
  if (entiers === '' && decimales === '') return null;
  // Calcul sur les chiffres, sans nombre à virgule : 0,29 vaut exactement 29 centimes.
  return Number(entiers || '0') * 100 + Number(decimales.padEnd(2, '0'));
}
