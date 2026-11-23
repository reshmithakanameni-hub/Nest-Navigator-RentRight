'use strict';
// Password recovery: single-use, expiring, hashed tokens; no account enumeration; sessions revoked.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-recovery-'));
process.env.DB_PATH = path.join(temp, 'recovery.sqlite');
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_PER_MINUTE = '5000';
process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '30';
const { server, db } = require('../server');
const mailer = require('../lib/mailer');
const api = require('./helpers/request')(server);
const OLD = 'OldPassword123', NEW = 'BrandNewPass456';
const tokenFrom = link => /#reset=([a-f0-9]{64})$/.exec(link)[1];

before(async () => {
  await api.post('/api/auth/register').send({ name: 'Reset User', email: 'reset@example.test', password: OLD, role: 'tenant' }).expect(201);
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(temp, { recursive: true, force: true }); });

test('forgot-password gives the same answer for known and unknown emails', async () => {
  const known = await api.post('/api/auth/forgot-password').send({ email: 'reset@example.test' }).expect(200);
  const unknown = await api.post('/api/auth/forgot-password').send({ email: 'nobody@example.test' }).expect(200);
  const invalid = await api.post('/api/auth/forgot-password').send({ email: 'not-an-email' }).expect(200);
  assert.equal(known.body.message, unknown.body.message);
  assert.equal(known.body.message, invalid.body.message);
  assert.ok(known.body.devResetLink, 'non-production responses include the demo link');
  assert.equal(unknown.body.devResetLink, undefined);
  assert.equal(mailer.outbox.at(-1).to, 'reset@example.test');
});

test('only a digest of the token is stored', async () => {
  const { body } = await api.post('/api/auth/forgot-password').send({ email: 'reset@example.test' }).expect(200);
  const token = tokenFrom(body.devResetLink);
  const rows = db.prepare('SELECT token_hash FROM password_resets').all();
  assert.equal(rows.length, 1, 'a new request replaces earlier unused links');
  assert.notEqual(rows[0].token_hash, token);
  assert.equal(rows[0].token_hash, crypto.createHash('sha256').update(token).digest('hex'));
});

test('a valid link sets a new password once, signs out old sessions and rejects reuse', async () => {
  const login = await api.post('/api/auth/login').send({ email: 'reset@example.test', password: OLD }).expect(200);
  const cookie = login.headers['set-cookie'].split(';')[0];
  await api.get('/api/auth/me').set('Cookie', cookie).expect(200);
  const { body } = await api.post('/api/auth/forgot-password').send({ email: 'reset@example.test' }).expect(200);
  const token = tokenFrom(body.devResetLink);

  await api.post('/api/auth/reset-password').send({ token: 'abc', newPassword: NEW }).expect(400);
  await api.post('/api/auth/reset-password').send({ token, newPassword: 'short1' }).expect(400);
  await api.post('/api/auth/reset-password').send({ token, newPassword: NEW }).expect(200);

  await api.get('/api/auth/me').set('Cookie', cookie).expect(401);
  await api.post('/api/auth/login').send({ email: 'reset@example.test', password: OLD }).expect(401);
  await api.post('/api/auth/login').send({ email: 'reset@example.test', password: NEW }).expect(200);
  await api.post('/api/auth/reset-password').send({ token, newPassword: 'AnotherPass789' }).expect(400);
});

test('expired and unknown tokens are rejected', async () => {
  const { body } = await api.post('/api/auth/forgot-password').send({ email: 'reset@example.test' }).expect(200);
  const token = tokenFrom(body.devResetLink);
  db.prepare('UPDATE password_resets SET expires_at = ?').run(Date.now() - 1000);
  await api.post('/api/auth/reset-password').send({ token, newPassword: NEW + 'x' }).expect(400);
  await api.post('/api/auth/reset-password').send({ token: 'f'.repeat(64), newPassword: NEW + 'x' }).expect(400);
});

test('recovery events are audited without tokens or passwords', () => {
  const events = db.prepare('SELECT event FROM audit_log').all().map(row => row.event);
  assert.ok(events.includes('PASSWORD_RESET_REQUESTED') && events.includes('PASSWORD_RESET_COMPLETED') && events.includes('PASSWORD_RESET_FAILED'));
  const text = JSON.stringify(db.prepare('SELECT * FROM audit_log').all());
  assert.ok(!text.includes(NEW) && !/[a-f0-9]{64}/.test(text));
});

test('recovery endpoints share the strict per-minute limit', async () => {
  let last;
  for (let i = 0; i < 40; i++) last = await api.post('/api/auth/forgot-password').send({ email: `x${i}@example.test` });
  assert.equal(last.status, 429);
});
