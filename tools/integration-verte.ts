// Étiquette « intégration verte » d'une demande de fusion (#36).
//
// Lancé par l'intégration continue avec Node (types retirés à l'exécution) :
//   node --experimental-strip-types tools/integration-verte.ts poser
//   node --experimental-strip-types tools/integration-verte.ts retirer
//
// « poser » : chaque workflow lancé par la demande de fusion appelle ce script après
// ses propres vérifications. Le dernier à finir voit toutes les vérifications
// terminées : si elles sont toutes vertes sur le dernier commit, il pose l'étiquette.
// « retirer » : à chaque nouveau commit, l'étiquette est retirée.
//
// Seule l'API de GitHub est appelée, avec le jeton fourni par GitHub Actions.

/** Préfixe du nom des tâches de l'étiquette : elles ne comptent pas dans le calcul. */
export const ETIQUETTE = 'Étiquette intégration verte';

/** Libellé de l'étiquette posée sur la demande de fusion. */
export const LIBELLE = 'intégration verte';

export type Tache = { nom: string; statut: string; conclusion: string | null };
export type Execution = { id: number; workflow: number; evenement: string };
export type Decision = 'poser' | 'retirer' | 'rien';

const CONCLUSIONS_VERTES = ['success', 'skipped', 'neutral'];

const compte = (t: Tache): boolean => !t.nom.startsWith(ETIQUETTE);

const terminee = (t: Tache): boolean => t.statut === 'completed';

const verte = (t: Tache): boolean =>
  terminee(t) && t.conclusion !== null && CONCLUSIONS_VERTES.includes(t.conclusion);

/** Toutes les vérifications sont terminées et vertes (et il y en a au moins une). */
export function estVerte(taches: readonly Tache[]): boolean {
  const comptees = taches.filter(compte);
  return comptees.length > 0 && comptees.every(verte);
}

/** Dernière exécution de chaque workflow lancée par la demande de fusion. */
export function dernieresExecutions(executions: readonly Execution[]): Execution[] {
  const parWorkflow = new Map<number, Execution>();
  for (const e of executions) {
    if (e.evenement !== 'pull_request') continue;
    const connue = parWorkflow.get(e.workflow);
    if (connue === undefined || e.id > connue.id) parWorkflow.set(e.workflow, e);
  }
  return [...parWorkflow.values()];
}

export function decider(etat: {
  taches: readonly Tache[];
  shaVerifie: string;
  shaCourant: string;
  etiquetee: boolean;
}): Decision {
  if (etat.shaVerifie !== etat.shaCourant) return 'rien';
  const comptees = etat.taches.filter(compte);
  if (comptees.some((t) => terminee(t) && !verte(t))) return etat.etiquetee ? 'retirer' : 'rien';
  if (estVerte(comptees)) return etat.etiquetee ? 'rien' : 'poser';
  return 'rien';
}

// ---------------------------------------------------------------------------
// Exécution dans GitHub Actions

type Json = Record<string, unknown>;

// Variables lues une à une : la règle Expo interdit l'accès dynamique à process.env.
const ENV: Record<string, string | undefined> = {
  GH_TOKEN: process.env.GH_TOKEN,
  DEPOT: process.env.DEPOT,
  DEMANDE: process.env.DEMANDE,
  SHA: process.env.SHA,
};

function variable(nom: keyof typeof ENV): string {
  const valeur = ENV[nom];
  if (valeur === undefined || valeur === '') throw new Error(`Variable ${nom} absente`);
  return valeur;
}

async function api(chemin: string, methode = 'GET', corps?: unknown): Promise<Json> {
  const reponse = await fetch(`https://api.github.com/repos/${variable('DEPOT')}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${variable('GH_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  if (methode === 'DELETE' && reponse.status === 404) return {};
  if (!reponse.ok) throw new Error(`${methode} ${chemin} : ${reponse.status}`);
  return reponse.status === 204 ? {} : ((await reponse.json()) as Json);
}

const liste = (valeur: unknown): Json[] => (Array.isArray(valeur) ? (valeur as Json[]) : []);

async function etat(numero: string): Promise<{ shaCourant: string; etiquetee: boolean }> {
  const demande = await api(`/pulls/${numero}`);
  const tete = demande.head as Json;
  return {
    shaCourant: String(tete.sha),
    etiquetee: liste(demande.labels).some((l) => l.name === LIBELLE),
  };
}

async function tachesDuCommit(sha: string): Promise<Tache[]> {
  const reponse = await api(`/actions/runs?head_sha=${sha}&per_page=100`);
  const executions = dernieresExecutions(
    liste(reponse.workflow_runs).map((r) => ({
      id: Number(r.id),
      workflow: Number(r.workflow_id),
      evenement: String(r.event),
    })),
  );
  const taches: Tache[] = [];
  for (const e of executions) {
    const jobs = await api(`/actions/runs/${e.id}/jobs?per_page=100`);
    for (const j of liste(jobs.jobs)) {
      taches.push({
        nom: String(j.name),
        statut: String(j.status),
        conclusion: j.conclusion === null ? null : String(j.conclusion),
      });
    }
  }
  return taches;
}

async function principal(commande: string | undefined): Promise<void> {
  const numero = variable('DEMANDE');
  const etiquette = `/issues/${numero}/labels`;
  if (commande === 'retirer') {
    await api(`${etiquette}/${encodeURIComponent(LIBELLE)}`, 'DELETE');
    console.log(`Étiquette « ${LIBELLE} » retirée.`);
    return;
  }
  if (commande !== 'poser') throw new Error('Commande attendue : poser ou retirer');
  const shaVerifie = variable('SHA');
  const taches = await tachesDuCommit(shaVerifie);
  for (const t of taches) console.log(`${t.nom} : ${t.statut} ${t.conclusion ?? ''}`);
  const decision = decider({ taches, shaVerifie, ...(await etat(numero)) });
  if (decision === 'poser') await api(etiquette, 'POST', { labels: [LIBELLE] });
  if (decision === 'retirer') await api(`${etiquette}/${encodeURIComponent(LIBELLE)}`, 'DELETE');
  console.log(`Décision : ${decision}`);
}

if (process.argv[1]?.endsWith('integration-verte.ts')) {
  principal(process.argv[2]).catch((erreur: unknown) => {
    console.error(erreur);
    process.exitCode = 1;
  });
}
