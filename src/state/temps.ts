// Conversion de l'heure du téléphone vers les formats du domaine et de la base.
// L'heure elle-même vient toujours de l'horloge (clock.ts) : ces fonctions ne la lisent pas.
import { format } from 'date-fns';

import type { LocalDateTime } from '../domain/scellement';

/** Jour AAAA-MM-JJ et heure HH:MM, dans le fuseau du téléphone. */
export function heureLocale(d: Date): LocalDateTime {
  return { day: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') };
}

/** Instant ISO 8601 avec le fuseau du téléphone, pour les dates d'écriture en base. */
export function instantLocal(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
