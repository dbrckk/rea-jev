import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Opaque, automatically issued browser sessions. No user-entered passwords or API tokens. */
export function createSessionManager(dataDir) {
  const keyPath = join(dataDir, '.cookie-signing-key');
  const key = existsSync(keyPath) ? readFileSync(keyPath) : randomBytes(32);
  if (!existsSync(keyPath)) writeFileSync(keyPath, key, { mode: 0o600, flag: 'wx' });
  if (key.length !== 32) throw new Error('Clé de session invalide');
  const sign = id => createHmac('sha256', key).update(id).digest('hex');
  function identify(req) {
    const cookie = String(req.headers.cookie || '').split(';').map(s => s.trim())
      .find(s => s.startsWith('rea_session='));
    if (!cookie) return null;
    const value = cookie.slice('rea_session='.length);
    const match = /^([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(value);
    if (!match) return null;
    const expected = Buffer.from(sign(match[1]), 'hex');
    if (!timingSafeEqual(expected, Buffer.from(match[2], 'hex'))) return null;
    return createHash('sha256').update(match[1]).digest('hex');
  }
  function bootstrap(req, res) {
    const existing = identify(req);
    if (existing) return existing;
    const id = randomBytes(32).toString('hex');
    const secure = Boolean(req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ||
      process.env.RENDER === 'true' || String(req.headers.host || '').endsWith('.onrender.com'));
    res.setHeader('Set-Cookie', 'rea_session=' + id + '.' + sign(id) +
      '; Path=/; Max-Age=604800; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : ''));
    return createHash('sha256').update(id).digest('hex');
  }
  return { identify, bootstrap };
}
