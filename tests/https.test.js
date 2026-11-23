'use strict';
// HTTPS: the server terminates TLS when a key/certificate are configured, marks cookies Secure and sends HSTS.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { execFileSync } = require('node:child_process');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-tls-'));
let haveOpenssl = true;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
    '-keyout', path.join(temp, 'key.pem'), '-out', path.join(temp, 'cert.pem')], { stdio: 'ignore' });
} catch { haveOpenssl = false; }
if (haveOpenssl) {
  process.env.TLS_KEY_FILE = path.join(temp, 'key.pem');
  process.env.TLS_CERT_FILE = path.join(temp, 'cert.pem');
}
process.env.DB_PATH = path.join(temp, 'tls.sqlite');
process.env.NODE_ENV = 'test';
process.env.FORCE_HTTPS = 'true';
const { server, db } = require('../server');
after(async () => { if (server.listening) await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(temp, { recursive: true, force: true }); });

const call = (port, method, route, body) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : null;
  const request = https.request({ host: '127.0.0.1', port, method, path: route, rejectUnauthorized: false,
    headers: { Origin: `https://127.0.0.1:${port}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) } }, response => {
    let text = ''; response.on('data', chunk => { text += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text }));
  });
  request.on('error', reject); if (payload) request.write(payload); request.end();
});

test('TLS server serves the API with HSTS and Secure session cookies', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const health = await call(port, 'GET', '/api/health');
  assert.equal(health.status, 200);
  assert.match(health.headers['strict-transport-security'], /max-age=\d+/);
  await call(port, 'POST', '/api/auth/register', { name: 'Tls User', email: 'tls@example.test', password: 'SecureDemo1234', role: 'tenant' });
  const login = await call(port, 'POST', '/api/auth/login', { email: 'tls@example.test', password: 'SecureDemo1234' });
  assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'][0];
  assert.match(cookie, /; Secure/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
});

test('a certificate without a key (or the reverse) is a startup error', () => {
  const { tlsOptions } = require('../lib/security');
  const saved = process.env.TLS_CERT_FILE; delete process.env.TLS_CERT_FILE;
  assert.throws(() => tlsOptions(), /both TLS_KEY_FILE and TLS_CERT_FILE/);
  if (saved) process.env.TLS_CERT_FILE = saved;
});
