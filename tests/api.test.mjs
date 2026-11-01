import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';

test('Zero-login interface, private sessions, limits, REA reports, deletion and assets', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'rea-jev-test-'));
  const originalRea = process.env.REA_CLI;
  process.env.REA_CLI = join(dataDir, 'missing-rea');
  const app = createApp({ dataDir, engine: 'free', maxUploadMB: 0.05, pluginDir: join(dataDir, 'not-installed') });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const base = 'http://127.0.0.1:' + app.address().port;
  const session = async () => {
    const response = await fetch(base + '/api/session');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.mode, 'browser-session');
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /^rea_session=[a-f0-9]{64}\.[a-f0-9]{64};/);
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    return cookie.split(';')[0];
  };
  const requestWith = cookie => (path, options = {}) => fetch(base + path, {
    ...options, headers: { Cookie: cookie, ...(options.headers || {}) }
  });
  try {
    // No manually entered token, key or account.
    assert.equal((await fetch(base + '/api/jobs')).status, 401);
    assert.equal((await fetch(base + '/api/jobs', { headers: { Cookie: 'rea_session=fake' } })).status, 401);
    const cookie = await session();
    const otherCookie = await session();
    assert.notEqual(cookie, otherCookie);
    const secureSession = await fetch(base + '/api/session', {
      headers: { 'X-Forwarded-Proto': 'https' }
    });
    assert.match(secureSession.headers.get('set-cookie'), /; Secure/);
    const req = requestWith(cookie);
    const other = requestWith(otherCookie);
    assert.equal((await req('/api/jobs', { method:'POST', headers:{ Origin:'https://evil.example' },body:'{}' })).status, 403);
    for (const path of ['/', '/app.js', '/app.css']) {
      const response = await req(path);
      assert.equal(response.status, 200);
      assert.ok((await response.text()).length > 100);
    }
    const page = await (await req('/')).text();
    assert.doesNotMatch(page, /Jeton privé du serveur|id="token"|id="authorized"/);
    const status = await req('/api/status');
    assert.equal(status.status, 200);
    assert.equal((await status.json()).engine, 'free');
    assert.equal((await req('/api/uploads', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'test'
    })).status, 415);
    assert.equal((await req('/api/uploads', {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.alloc(60000, 7)
    })).status, 413);
    const uploaded = await req('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent('../product.exe') },
      body: Buffer.from([0x4d, 0x5a, 0x90, 0x00])
    });
    assert.equal(uploaded.status, 201);
    const upload = await uploaded.json();
    assert.equal(upload.filename, 'product.exe');
    assert.equal(upload.size, 4);
    assert.match(upload.sha256, /^[a-f0-9]{64}$/);

    // A different anonymous browser is never allowed to use the upload or see results.
    const steal = await other('/api/jobs', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({uploadId: upload.id, question:'Voir le fichier', authorized:true})
    });
    assert.equal(steal.status, 404);
    assert.deepEqual(await (await other('/api/jobs')).json(), []);

    const invalidJob = await req('/api/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId: upload.id, question: 'Comprendre', authorized: false })
    });
    assert.equal(invalidJob.status, 400);
    const created = await req('/api/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId: upload.id, question: 'Comprendre les fonctions', authorized: true })
    });
    assert.equal(created.status, 201);
    const job = await created.json();
    assert.equal(job.filename, 'product.exe');
    let result;
    for (let i = 0; i < 60; i++) {
      const r = await req('/api/jobs/' + job.id);
      result = await r.json();
      if (result.status === 'failed') break;
      await new Promise(r => setTimeout(r, 25));
    }
    assert.equal(result.status, 'failed');
    assert.match(result.error, /REA|exploitable/);
    assert.equal((await other('/api/jobs/' + job.id)).status, 404);
    assert.equal((await other('/api/jobs/' + job.id + '/report')).status, 404);
    assert.equal((await other('/api/jobs/' + job.id + '/cancel', { method:'POST' })).status, 404);
    assert.equal((await other('/api/jobs/' + job.id, { method:'DELETE' })).status, 404);
    const report = await req('/api/jobs/' + job.id + '/report');
    assert.equal(report.status, 200);
    assert.match(await report.text(), /Non vérifié/);
    assert.equal((await (await req('/api/jobs')).json()).length, 1);

    // Anonymous limits: at most 3 retained files per browser.
    for (let i = 0; i < 2; i++) {
      const up = await req('/api/uploads', { method:'POST',
        headers:{'Content-Type':'application/octet-stream','X-Filename':'file'+i+'.bin'},body:Buffer.from([1,2,3])});
      assert.equal(up.status, 201);
    }
    assert.equal((await req('/api/uploads', { method:'POST',
      headers:{'Content-Type':'application/octet-stream','X-Filename':'extra.bin'},body:Buffer.from([1,2,3])})).status, 429);

    const removed = await req('/api/jobs/' + job.id, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal(readdirSync(join(dataDir, 'jobs')).length, 0);
    assert.equal(readdirSync(join(dataDir, 'uploads')).filter(n=>n.endsWith('.json')).length, 2);
    assert.deepEqual(await (await req('/api/jobs')).json(), []);
    assert.deepEqual(await (await other('/api/jobs')).json(), []);
  } finally {
    if (originalRea === undefined) delete process.env.REA_CLI;
    else process.env.REA_CLI = originalRea;
    await new Promise(r => app.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});
