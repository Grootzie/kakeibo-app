import { readFileSync } from 'fs';
import { join } from 'path';
import { fr } from '../src/i18n/fr';

describe('parcours Maestro de démarrage', () => {
  const parcours = readFileSync(join(__dirname, '..', 'e2e', 'accueil.yaml'), 'utf8');

  it("vérifie que l'accueil affiche le bouton « Noter une dépense »", () => {
    expect(parcours).toContain(`- assertVisible: '${fr.accueil.noterDepense}'`);
    expect(fr.accueil.noterDepense).toBe('Noter une dépense');
  });

  it('lance l’appli et prend une capture', () => {
    expect(parcours).toMatch(/appId: app\.kakeibo/);
    expect(parcours).toMatch(/- launchApp/);
    expect(parcours).toMatch(/- takeScreenshot:/);
  });
});
