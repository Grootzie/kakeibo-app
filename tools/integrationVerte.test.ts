import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ETIQUETTE,
  type Execution,
  type Tache,
  decider,
  dernieresExecutions,
  estVerte,
  tachesDeLExecution,
} from './integration-verte';

const tache = (nom: string, statut: string, conclusion: string | null): Tache => ({
  nom,
  statut,
  conclusion,
});
const ok = (nom: string): Tache => tache(nom, 'completed', 'success');

describe('étiquette « intégration verte »', () => {
  describe('estVerte', () => {
    it('est verte quand toutes les vérifications sont terminées et réussies', () => {
      expect(estVerte([ok('Types, lint, tests et export web'), ok('APK de développement')])).toBe(
        true,
      );
    });

    it('accepte une vérification sautée', () => {
      expect(
        estVerte([ok('Parcours'), tache('APK de développement', 'completed', 'skipped')]),
      ).toBe(true);
    });

    it("n'est pas verte tant qu'une vérification est en cours ou en attente", () => {
      expect(estVerte([ok('Types'), tache('APK', 'in_progress', null)])).toBe(false);
      expect(estVerte([ok('Types'), tache('Parcours', 'queued', null)])).toBe(false);
      expect(estVerte([ok('Types'), tache('Parcours', 'waiting', null)])).toBe(false);
    });

    it("n'est pas verte si une vérification échoue ou est annulée", () => {
      expect(estVerte([ok('Types'), tache('APK', 'completed', 'failure')])).toBe(false);
      expect(estVerte([ok('Types'), tache('APK', 'completed', 'cancelled')])).toBe(false);
      expect(estVerte([ok('Types'), tache('APK', 'completed', 'timed_out')])).toBe(false);
    });

    it("ignore les tâches de l'étiquette elle-même", () => {
      expect(estVerte([ok('Types'), tache(`${ETIQUETTE} · pose`, 'in_progress', null)])).toBe(true);
    });

    it("n'est pas verte sans aucune vérification", () => {
      expect(estVerte([])).toBe(false);
      expect(estVerte([tache(`${ETIQUETTE} · pose`, 'in_progress', null)])).toBe(false);
    });
  });

  describe('dernieresExecutions', () => {
    const execution = (id: number, workflow: number, evenement = 'pull_request'): Execution => ({
      id,
      workflow,
      evenement,
      statut: 'completed',
    });

    it('garde la dernière exécution de chaque workflow lancée par la demande de fusion', () => {
      expect(
        dernieresExecutions([
          execution(10, 1),
          execution(12, 1),
          execution(11, 2),
          execution(13, 2, 'workflow_dispatch'),
          execution(14, 3, 'push'),
        ]).map((e) => e.id),
      ).toEqual([12, 11]);
    });
  });

  describe('tachesDeLExecution', () => {
    it("ajoute une tâche en attente quand l'exécution tourne encore sans que son étiquette soit lancée", () => {
      // Entre la fin de l'APK et le départ des parcours, l'API ne liste pas encore les parcours.
      const taches = tachesDeLExecution('in_progress', [ok('APK de développement')]);
      expect(estVerte(taches)).toBe(false);
    });

    it("n'ajoute rien quand la tâche d'étiquette de l'exécution est lancée", () => {
      const taches = tachesDeLExecution('in_progress', [
        ok('APK de développement'),
        ok('Parcours Maestro et captures'),
        tache(`${ETIQUETTE} · pose`, 'in_progress', null),
      ]);
      expect(estVerte(taches)).toBe(true);
    });

    it("n'ajoute rien pour une exécution terminée", () => {
      expect(tachesDeLExecution('completed', [ok('Types')])).toEqual([ok('Types')]);
    });
  });

  describe('decider', () => {
    const vert = [ok('Types'), ok('APK de développement'), ok('Parcours Maestro et captures')];

    it("pose l'étiquette quand tout est vert sur le dernier commit", () => {
      expect(
        decider({ taches: vert, shaVerifie: 'abc', shaCourant: 'abc', etiquetee: false }),
      ).toBe('poser');
    });

    it("ne fait rien si l'étiquette est déjà là", () => {
      expect(decider({ taches: vert, shaVerifie: 'abc', shaCourant: 'abc', etiquetee: true })).toBe(
        'rien',
      );
    });

    it("ne pose rien pour un commit qui n'est plus le dernier", () => {
      expect(
        decider({ taches: vert, shaVerifie: 'abc', shaCourant: 'def', etiquetee: false }),
      ).toBe('rien');
    });

    it("retire l'étiquette si une vérification du dernier commit échoue", () => {
      const rouge = [ok('Types'), tache('APK', 'completed', 'failure')];
      expect(
        decider({ taches: rouge, shaVerifie: 'abc', shaCourant: 'abc', etiquetee: true }),
      ).toBe('retirer');
    });

    it('attend sans rien changer tant que des vérifications tournent', () => {
      const enCours = [ok('Types'), tache('APK', 'in_progress', null)];
      expect(
        decider({ taches: enCours, shaVerifie: 'abc', shaCourant: 'abc', etiquetee: false }),
      ).toBe('rien');
    });
  });

  describe('workflows', () => {
    const lire = (fichier: string): string =>
      readFileSync(join(__dirname, '..', '.github', 'workflows', fichier), 'utf8');

    it.each(['ci.yml', 'android.yml'])(
      "%s pose l'étiquette après ses vérifications, sauf s'il est annulé",
      (fichier) => {
        const contenu = lire(fichier);
        expect(contenu).toMatch(/name: Étiquette intégration verte · pose/);
        expect(contenu).toMatch(/integration-verte\.ts poser/);
        expect(contenu).toMatch(/!cancelled\(\) && github\.event_name == 'pull_request'/);
        expect(contenu).toMatch(/pull-requests: write/);
      },
    );

    it("ci.yml retire l'étiquette dès qu'un nouveau commit arrive", () => {
      const ci = lire('ci.yml');
      expect(ci).toMatch(/name: Étiquette intégration verte · retrait/);
      expect(ci).toMatch(/github\.event\.action == 'synchronize'/);
      expect(ci).toMatch(/integration-verte\.ts retirer/);
    });

    it('le nom des tâches correspond au préfixe ignoré par le calcul', () => {
      expect(ETIQUETTE).toBe('Étiquette intégration verte');
    });
  });
});
