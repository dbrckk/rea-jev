import { openSync, readSync, closeSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { extname, resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { choosePlan, explainFindings } from './openjev.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MAX_RESULT = 640 * 1024;
const MAX_REPORT_EACH = 90000;

export function detectType(path, filename) {
  const fd = openSync(path, 'r');
  const head = Buffer.alloc(16);
  let count;
  try { count = readSync(fd, head, 0, 16, 0); }
  finally { closeSync(fd); }
  const ext = extname(filename).toLowerCase();
  if (count >= 4 && head.readUInt32LE(0) === 0x464c457f) return 'elf';
  if (count >= 2 && head.toString('ascii', 0, 2) === 'MZ') return 'pe';
  if (count >= 4 && head.toString('ascii', 0, 4) === '\0asm') return 'wasm';
  if (count >= 15 && head.toString('ascii', 0, 15) === 'SQLite format 3') return 'sqlite';
  if (count >= 4 && head.toString('ascii', 0, 4) === 'GGUF') return 'model';
  if (count >= 2 && head.toString('ascii', 0, 2) === 'PK') {
    if (ext === '.apk' || ext === '.aab') return 'apk';
    return 'archive';
  }
  if (['.exe', '.dll'].includes(ext)) return 'binary-unknown';
  if (ext === '.asar') return 'javascript';
  return 'unknown';
}

export function planAnalysis(type, question = '') {
  // Only static inspections: never run the uploaded program.
  const q = question.toLocaleLowerCase('fr');
  const plan = [];
  function add(command, description) { if (!plan.some(item => item.command === command)) plan.push({ command, description }); }
  if (type === 'apk') {
    add('inspect-artifact', 'Inventaire statique de l’archive APK');
  } else if (type === 'pe') {
    add('inspect-pe-imports', 'Fonctions et dépendances Windows importées');
    if (/certif|signat|éditeur|signer|authent/.test(q)) add('inspect-pe-certificates', 'Certificats Authenticode');
    add('inspect-artifact', 'Analyse du conteneur PE');
  } else if (type === 'elf') {
    add('inspect-elf-notes', 'Notes ELF et identifiants de compilation');
    add('inspect-artifact', 'Conteneur ELF et composants reconnus');
  } else if (type === 'sqlite') {
    add('inspect-sqlite-database', 'Tables et structure de la base SQLite');
  } else if (type === 'model') {
    add('inspect-model-artifact', 'Métadonnées du modèle');
  } else if (type === 'javascript') {
    add('analyze-javascript-application', 'Modules de l’application et imports');
  } else {
    add('inspect-artifact', 'Détection et inspection du format');
  }
  return plan.slice(0, 3);
}

function sanitize(value) {
  if (value == null) return value;
  if (typeof value === 'string') return value.slice(0, 20000);
  if (Array.isArray(value)) return value.slice(0, 120).map(sanitize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 100).map(([k,v]) => [k,sanitize(v)]));
  return value;
}
function extractFields(value) {
  if (!value || typeof value !== 'object') return [];
  const keys = ['evidence_id','parent_evidence_id','format','detected_format','file_type','type','architecture',
    'status','coverage','limitations','unknowns','warnings','errors','package','summary','signers','mitigations'];
  return Object.entries(value).filter(([key,val]) => keys.includes(key) && val != null);
}
export function buildReport({ filename, size, sha256, type, question, outcomes }) {
  const lines = [
    '# Rapport d’inspection REA — mode gratuit',
    '',
    '**Fichier :** ' + filename.replace(/[\r\n]/g, '_'),
    '**Taille :** ' + size + ' octets',
    '**SHA-256 :** ' + sha256,
    '**Type identifié :** ' + type,
    '',
    '## Consigne',
    question.replace(/[\r\n]+/g, ' ').slice(0, 2000),
    '',
    '## Analyses réalisées',
    '',
    'Ce rapport contient des observations statiques de REA. Aucune affirmation sur le comportement réel du programme n’est faite sans preuve.',
    ''
  ];
  for (const outcome of outcomes) {
    lines.push('### ' + outcome.description + ' (rea ' + outcome.command + ')', '');
    if (!outcome.ok) {
      lines.push('**Non vérifié :** ' + outcome.error, '');
      continue;
    }
    const fields = extractFields(outcome.data);
    if (fields.length) {
      lines.push('**Éléments relevés :**', '');
      for (const [k,v] of fields) lines.push('- **' + k + ' :** ' + JSON.stringify(sanitize(v)).slice(0, 2000));
      lines.push('');
    }
    lines.push('Données REA (extrait JSON) :', '');
    for (const l of JSON.stringify(sanitize(outcome.data), null, 2).slice(0, MAX_REPORT_EACH).split('\n')) lines.push('    ' + l);
    lines.push('');
  }
  const done = outcomes.filter(item => item.ok);
  lines.push('## Limites et prochaines investigations', '');
  if (!done.length) {
    lines.push('REA n’a retourné aucune observation exploitable. Le moteur ou le format peut être indisponible.', '');
  } else {
    lines.push('Les observations ci-dessus portent uniquement sur le fichier fourni, pas sur son exécution.',
      'Pour retrouver précisément les algorithmes et comportements demandés, une enquête de décompilation approfondie ou un agent génératif supplémentaire peut être nécessaire.', '');
  }
  lines.push('**Jev TypeSafe n’a pas été appelé :** ce mode ne consomme aucun crédit ni jeton d’IA. Les opérations REA sont choisies par règles reproductibles, pas par une IA autonome.', '',
    '**Sécurité :** le fichier cible n’a pas été exécuté par ce flux ; les bibliothèques d’analyse ont néanmoins lu des données non fiables.', '');
  return lines.join('\n');
}

function execInspection(command, target, { timeoutMs, onProcess, signal }) {
  const binary = process.env.REA_CLI || join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'rea.cmd' : 'rea');
  return new Promise(resolveResult => {
    if (!existsSync(binary)) return resolveResult({ ok:false, error:'REA CLI absent sur le serveur' });
    const args = [command, target, '--json'];
    const parts = [];
    let outputSize = 0, stderr = '', oversized = false, timedOut = false, settled = false;
    let proc;
    try {
      proc = spawn(binary, args, { cwd: ROOT, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=320' },
        shell: false, detached: process.platform !== 'win32', stdio: ['ignore','pipe','pipe'], signal });
    } catch(e) { return resolveResult({ ok:false, error: String(e.message) }); }
    if (onProcess) onProcess(proc);
    const timer = setTimeout(() => {
      timedOut = true; try { proc.kill('SIGTERM'); } catch {}
    }, timeoutMs);
    timer.unref();
    proc.stdout.on('data', chunk => {
      outputSize += chunk.length;
      if (outputSize <= MAX_RESULT) parts.push(chunk);
      else if (!oversized) { oversized = true; try { proc.kill('SIGTERM'); } catch {} }
    });
    proc.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
    proc.on('error', e => { stderr = (stderr + String(e.message)).slice(-4000); });
    proc.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return resolveResult({ ok:false, error:'Délai maximum REA atteint' });
      if (signal?.aborted) return resolveResult({ ok:false, error:'Analyse annulée' });
      if (oversized) return resolveResult({ ok:false, error:'Résultat trop volumineux pour ce serveur gratuit' });
      if (code !== 0) return resolveResult({ ok:false, error:('REA: ' + (stderr.trim() || 'code ' + code)).slice(0, 450) });
      try {
        const str = Buffer.concat(parts).toString('utf8');
        const data = JSON.parse(str);
        if (data?.error) return resolveResult({ ok:false, error:JSON.stringify(data.error).slice(0, 400) });
        resolveResult({ ok:true, data });
      } catch {
        resolveResult({ ok:false, error:'REA a retourné une réponse non JSON' });
      }
    });
  });
}
export async function runFreeAnalysis({ target, filename, question, sha256, reportPath, log = () => {}, signal, onProcess }) {
  const type = detectType(target, filename);
  const plan = await choosePlan(planAnalysis(type, question), { type, question }, log);
  log('Mode gratuit REA, sans API payante. Format détecté : ' + type);
  log('Plan REA : ' + plan.map(x => x.command).join(', '));
  const outcomes = [];
  for (const step of plan) {
    if (signal?.aborted) throw new Error('Analyse annulée');
    log('Lancement : rea ' + step.command);
    const result = await execInspection(step.command, target, { timeoutMs: 65000, signal, onProcess });
    outcomes.push({ ...step, ...result });
    log(result.ok ? 'Preuves enregistrées : ' + step.description : 'Étape non vérifiée : ' + result.error);
  }
  const report = buildReport({filename,sha256,size:statSync(target).size,type,question,outcomes});
  const explanation = await explainFindings({question, type, outcomes}, log);
  const complete = explanation ? report + '\n\n## Interprétation OpenJev (inférence IA, non preuve)\n\n' + explanation + '\n\nCe texte a été produit par DiffusionGemma avec le quota gratuit Codiv ; seule la sortie brute REA ci-dessus constitue une observation.\n' : report;
  writeFileSync(reportPath, complete, { mode:0o600 });
  const successes = outcomes.filter(x => x.ok).length;
  return { ok: successes > 0, successCount: successes, plannedCount: outcomes.length };
}
