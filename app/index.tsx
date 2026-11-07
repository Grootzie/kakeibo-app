import { useIsFocused, useRouter } from 'expo-router';
import { useState } from 'react';

import { kakeibo } from '@/state/appStore';
import { HorlogeDev } from '@/ui/HorlogeDev';
import { EcranAccueil } from '@/ui/accueil/EcranAccueil';

export default function Home() {
  const router = useRouter();
  const [horlogeVisible, setHorlogeVisible] = useState(false);
  const visible = useIsFocused();
  return (
    <EcranAccueil
      store={kakeibo}
      visible={visible}
      onAppuiLongDate={() => setHorlogeVisible((v) => !v)}
      onCloturer={() => router.push('/cloturer')}
      onRattraper={(jour) => router.push({ pathname: '/cloturer', params: { jour } })}
    >
      {horlogeVisible && <HorlogeDev />}
    </EcranAccueil>
  );
}
