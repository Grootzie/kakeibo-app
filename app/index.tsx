import { useMemo, useState } from 'react';

import { useKakeibo } from '@/state/appStore';
import { vueAccueil } from '@/state/selecteurs';
import { HorlogeDev } from '@/ui/HorlogeDev';
import { Accueil } from '@/ui/accueil/Accueil';

export default function Home() {
  const [horlogeVisible, setHorlogeVisible] = useState(false);
  const etat = useKakeibo((s) => s.etat);
  const maintenant = useKakeibo((s) => s.maintenant);
  const vue = useMemo(
    () => (etat && maintenant ? vueAccueil(etat, maintenant) : null),
    [etat, maintenant],
  );
  return (
    <Accueil vue={vue} onAppuiLongDate={() => setHorlogeVisible((v) => !v)}>
      {horlogeVisible && <HorlogeDev />}
    </Accueil>
  );
}
