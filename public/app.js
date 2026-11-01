const el = id => document.getElementById(id);
let selectedJob = null;
let jobs = [];
let maxUploadBytes = 30 * 1048576;
// A private, signed HttpOnly cookie is issued automatically. Nothing to enter.
const sessionReady = fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' })
  .then(response => { if (!response.ok) throw new Error('Impossible de créer la session privée'); });

async function api(path, options = {}) {
  if (path !== '/api/session') await sessionReady;
  const headers = { ...(options.headers || {}) };
  const response = await fetch(path, { ...options, headers, cache: 'no-store', credentials: 'same-origin' });
  let body;
  if ((response.headers.get('content-type') || '').includes('application/json')) body = await response.json();
  else body = await response.text();
  if (!response.ok) throw new Error(body.error || 'Erreur HTTP ' + response.status);
  return body;
}
function niceBytes(value) {
  if (!Number.isFinite(value)) return '?';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' Kio';
  return (value / (1024 * 1024)).toFixed(1) + ' Mio';
}
function date(value) { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
function statusFr(value) {
  return ({ queued: 'En attente', running: 'Analyse en cours', done: 'Terminée', failed: 'Échec', cancelled: 'Annulée', interrupted: 'Interrompue' })[value] || value;
}
function node(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function action(label, handler, className) {
  const b = node('button', label, className || 'subtle');
  b.type = 'button'; b.addEventListener('click', handler);
  return b;
}
function selectJob(id) { selectedJob = id; renderJobs(); renderDetail(); }
function renderJobs() {
  const target = el('jobs'); target.replaceChildren();
  if (!jobs.length) { target.append(node('p', 'Aucune analyse. Importez un fichier pour commencer.', 'placeholder')); return; }
  jobs.forEach(job => {
    const row = node('button', undefined, 'job ' + (job.id === selectedJob ? 'selected' : ''));
    row.type = 'button';
    const top = node('div', undefined, 'job-top');
    top.append(node('strong', job.filename), node('span', statusFr(job.status), 'state ' + job.status));
    row.append(top, node('small', niceBytes(job.size) + ' · ' + date(job.createdAt)));
    row.addEventListener('click', () => selectJob(job.id));
    target.append(row);
  });
}
function renderDetail() {
  const job = jobs.find(j => j.id === selectedJob);
  el('detail-actions').replaceChildren();
  el('report').replaceChildren();
  if (!job) {
    el('detail-meta').textContent = 'Sélectionnez une analyse.';
    el('logs').textContent = 'Le journal apparaîtra ici.';
    return;
  }
  el('detail-meta').textContent = job.filename + ' · SHA256 ' + job.sha256 + ' · ' + statusFr(job.status) + (job.error ? ' · ' + job.error : '');
  el('logs').textContent = (job.lines || []).join('\n') || 'En attente du démarrage de l’analyse…';
  if (job.hasReport) {
    el('detail-actions').append(action('Ouvrir le rapport', async () => {
      try {
        const content = await api('/api/jobs/' + job.id + '/report');
        const blob = new Blob([content], { type: 'text/markdown' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'rea-report-' + job.id + '.md';
        link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      } catch (error) { showMessage(error.message, true); }
    }, 'primary small'));
    el('report').append(node('p', 'Un rapport Markdown est disponible pour cette analyse.'));
  }
  if (['queued', 'running'].includes(job.status)) {
    el('detail-actions').append(action('Annuler', async () => {
      try { await api('/api/jobs/' + job.id + '/cancel', { method: 'POST' }); await refresh(); }
      catch (error) { showMessage(error.message, true); }
    }));
  } else {
    el('detail-actions').append(action('Supprimer les données', async () => {
      if (!confirm('Supprimer définitivement ce fichier, ses traces et son rapport ?')) return;
      try {
        await api('/api/jobs/' + job.id, { method: 'DELETE' });
        selectedJob = null; await refresh();
      } catch (error) { showMessage(error.message, true); }
    }));
  }
}
function showMessage(value, error = false) {
  el('form-message').textContent = value;
  el('form-message').className = 'message ' + (error ? 'error' : '');
}
async function refresh() {
  try {
    const [data, status] = await Promise.all([api('/api/jobs'), api('/api/status')]);
    jobs = data;
    maxUploadBytes = Number(status.maxUploadMB || 30) * 1048576;
    if (!selectedJob || !jobs.some(j => j.id === selectedJob)) selectedJob = jobs[0]?.id || null;
    renderJobs(); renderDetail();
    const ready = status.engine === 'free' ? status.reaInstalled : (status.claudeInstalled && status.pluginInstalled);
    el('status-label').textContent = ready ? 'Moteur prêt' : 'Moteur indisponible';
    el('status-dot').className = 'dot ' + (ready ? 'ready' : 'warn');
    el('system').textContent = status.engine === 'free'
      ? ['REA : ' + (status.reaInstalled ? 'opérationnel' : 'indisponible'),
         'System One : ' + (status.jevHealth?.connected
           ? ((status.jevHealth.provider === 'codiv' ? 'OpenJev' : 'Jev TypeSafe') + ' CONNECTÉ — réponse vérifiée')
           : (status.jevAvailability === 'configured-not-verified'
             ? 'configuré mais non fonctionnel (' + (status.jevHealth?.reason || 'non vérifié') + ')'
             : 'NON CONNECTÉ — décisions par règles locales')),
         'Rapports et preuves séparés par session',
         'Limite : ' + status.maxUploadMB + ' Mio'].join('  ·  ')
      : ['Claude Code : ' + (status.claudeInstalled ? 'présent' : 'absent'),
         'REA–Jev : ' + (status.pluginInstalled ? 'présent' : 'absent'),
         'Clé Jev : ' + (status.jevConfigured ? 'configurée' : 'absente')].join('  ·  ');
  } catch (error) {
    el('status-label').textContent = 'Connexion indisponible';
    el('status-dot').className = 'dot warn';
    el('system').textContent = error.message;
  }
}
el('file').addEventListener('change', () => {
  const file = el('file').files[0];
  el('file-info').textContent = file ? file.name + ' — ' + niceBytes(file.size) : 'APK, EXE, bibliothèques, archives ou autre artefact';
  if (file && file.size > maxUploadBytes) showMessage('Fichier trop volumineux pour ce service gratuit (' + niceBytes(maxUploadBytes) + ' maximum).', true);
});
const drop = el('dropzone');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', e => {
  e.preventDefault(); drop.classList.remove('dragging');
  if (e.dataTransfer.files.length) {
    el('file').files = e.dataTransfer.files;
    el('file').dispatchEvent(new Event('change'));
  }
});
el('start').addEventListener('click', async () => {
  const file = el('file').files[0];
  const question = el('question').value.trim();
  if (!file || !question) return showMessage('Choisir un fichier et indiquer une consigne.', true);
  if (file.size > maxUploadBytes) return showMessage('Fichier trop volumineux (' + niceBytes(maxUploadBytes) + ' maximum).', true);
  el('start').disabled = true;
  try {
    await sessionReady;
    showMessage('Transfert du fichier…');
    const upload = await api('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) }, body: file });
    const job = await api('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: upload.id, question, authorized: true }) });
    selectedJob = job.id;
    showMessage('Analyse ajoutée à la file d’attente.');
    el('file').value = ''; el('file-info').textContent = 'APK, EXE, bibliothèques, archives ou autre artefact';
    await refresh();
  } catch (error) { showMessage(error.message, true); }
  finally { el('start').disabled = false; }
});
el('refresh').addEventListener('click', refresh);
refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 2500);
