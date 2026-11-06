// Icône d'une catégorie, décorative : le nom de la catégorie l'accompagne toujours.
// Signe typographique provisoire : le dessin viendra avec les visuels.
import { Text } from 'react-native';

import { type CategorieId, theme } from '../theme';

export function IconeCategorie({
  categorie,
  couleur,
}: {
  categorie: CategorieId;
  couleur: string;
}) {
  return (
    <Text
      testID={`icone-${categorie}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ color: couleur, fontSize: 20, width: 24, textAlign: 'center' }}
    >
      {theme.categories[categorie].signe}
    </Text>
  );
}
