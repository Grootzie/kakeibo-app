// Dessin provisoire d'un objet, en attendant le lot de visuels : un cadre de papier avec
// l'initiale de son nom, une fêlure en travers si l'objet est fêlé, une veine d'or s'il est réparé. La maison arrive en J4 :
// d'ici là, le bilan montre l'objet seul.
import { Text, View } from 'react-native';

import type { NomObjet } from '../../i18n/fr';
import { theme } from '../theme';

const c = theme.couleurs;

export interface PropsObjetProvisoire {
  objet: NomObjet;
  taille: number;
  fele?: boolean;
  /** Réparé à l'or : la fêlure devient une veine d'or (#66). */
  repare?: boolean;
  /** Libellé lu par le lecteur d'écran ; sans libellé, le dessin n'est pas annoncé seul. */
  libelle?: string;
}

export function ObjetProvisoire({
  objet,
  taille,
  fele = false,
  repare = false,
  libelle,
}: PropsObjetProvisoire) {
  return (
    <View
      accessible={libelle !== undefined}
      accessibilityLabel={libelle}
      accessibilityRole={libelle === undefined ? undefined : 'image'}
      style={{
        width: taille,
        height: taille,
        borderRadius: taille / 6,
        borderWidth: 2,
        borderColor: c.principal,
        backgroundColor: c.discret,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Text style={{ color: c.texte, fontSize: taille / 2.4, fontWeight: '700' }}>
        {objet.nom[0].toUpperCase()}
      </Text>
      {(fele || repare) && (
        <View
          testID={repare ? 'veine-or' : undefined}
          style={{
            position: 'absolute',
            width: repare ? 5 : 3,
            height: taille * 1.2,
            backgroundColor: repare ? c.or : c.principal,
            transform: [{ rotate: '28deg' }],
          }}
        />
      )}
    </View>
  );
}
