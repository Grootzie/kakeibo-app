import { useState } from 'react';

import { kakeibo } from '@/state/appStore';
import { HorlogeDev } from '@/ui/HorlogeDev';
import { EcranAccueil } from '@/ui/accueil/EcranAccueil';

export default function Home() {
  const [horlogeVisible, setHorlogeVisible] = useState(false);
  return (
    <EcranAccueil store={kakeibo} onAppuiLongDate={() => setHorlogeVisible((v) => !v)}>
      {horlogeVisible && <HorlogeDev />}
    </EcranAccueil>
  );
}
