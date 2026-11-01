import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/server.mjs';

test('HTTP: token, raw upload, queue, errors, deletion and assets', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'rea-jev-test-'));
  const token = 'this-is-a-long-auth-token';
  const app = createApp({ dataDir, token, engine: 'free', maxUploadMB: 0.05, pluginDir: join(dataDir, 'not-installed') });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const base = 'http://127.0.0.1:' + app.address().port;
  const req = (path, options = {}) => fetch(base + path, {
    ...options, headers: { Authorization: 'Bearer ' + token, ...(options.headers || {}) }
  });
  try {
    const unauthorized = await fetch(base + '/api/jobs');
    assert.equal(unauthorized.status, 401);
    const origin = await req('/api/jobs', { method: 'POST', headers: { Origin: 'https://wrong.example' }, body: '{}' });
    assert.equal(origin.status, 403);
    for (const path of ['/', '/app.js', '/app.css']) {
      const response = await req(path);
      assert.equal(response.status, 200);
      assert.ok((await response.text()).length > 100);
    }
    const status = await req('/api/status');
    assert.equal(status.status, 200);
    assert.equal((await status.json()).engine, 'free');
    const badContent = await req('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'test' });
    assert.equal(badContent.status, 415);
    const tooBig = await req('/api/uploads', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.alloc(60000, 7) });
    assert.equal(tooBig.status, 413);
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
    const report = await req('/api/jobs/' + job.id + '/report');
    assert.equal(report.status, 404);
    const list = await req('/api/jobs');
    assert.equal((await list.json()).length, 1);
    const removed = await req('/api/jobs/' + job.id, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal(readdirSync(join(dataDir, 'jobs')).length, 0);
    assert.equal(readdirSync(join(dataDir, 'uploads')).length, 0);
  } finally {
    await new Promise(r => app.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});
