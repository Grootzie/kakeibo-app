import { Redirect, useIsFocused, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { kakeibo, useKakeibo } from '@/state/appStore';
import { bienvenueAAfficher } from '@/state/bienvenue';
import { HorlogeDev } from '@/ui/HorlogeDev';
import { EcranAccueil } from '@/ui/accueil/EcranAccueil';
import { theme } from '@/ui/theme';

function etatCharge(s: { etat: unknown }): boolean {
  return s.etat !== null;
}

export default function Home() {
  const router = useRouter();
  const [horlogeVisible, setHorlogeVisible] = useState(false);
  const visible = useIsFocused();
  const charge = useKakeibo(etatCharge);
  const bienvenue = useKakeibo(bienvenueAAfficher);
  // Le temps de lire la base : une page vide, pour ne pas montrer l'accueil avant la bienvenue.
  if (!charge) return <View style={{ flex: 1, backgroundColor: theme.couleurs.fond }} />;
  // Première ouverture (E1) : tant qu'aucun budget n'est posé, la bienvenue passe d'abord.
  if (bienvenue) return <Redirect href="/bienvenue" />;
  return (
    <EcranAccueil
      store={kakeibo}
      visible={visible}
      onAppuiLongDate={() => setHorlogeVisible((v) => !v)}
      onCloturer={() => router.push('/cloturer')}
      onRattraper={(jour) => router.push({ pathname: '/cloturer', params: { jour } })}
      onBilanSemaine={() => router.push('/bilan-semaine')}
      onBilanMois={() => router.push('/bilan-mois')}
      onMaison={() => router.push('/maison')}
    >
      {horlogeVisible && <HorlogeDev />}
    </EcranAccueil>
  );
}
