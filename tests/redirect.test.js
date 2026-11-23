'use strict';
// Behind a TLS-terminating proxy: plain HTTP is redirected, forwarded HTTPS is accepted.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-redirect-'));
process.env.DB_PATH = path.join(temp, 'redirect.sqlite');
process.env.NODE_ENV = 'test';
process.env.FORCE_HTTPS = 'true';
process.env.TRUST_PROXY = 'true';
const { server, db } = require('../server');
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(temp, { recursive: true, force: true }); });

const call = (port, route, headers = {}) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: route, headers: { Host: 'app.example.test', ...headers } }, response => {
    response.resume(); response.on('end', () => resolve(response));
  }).on('error', reject);
});

test('plain HTTP is redirected to HTTPS, forwarded HTTPS and health probes are not', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const redirected = await call(port, '/index.html?x=1');
  assert.equal(redirected.statusCode, 308);
  assert.equal(redirected.headers.location, 'https://app.example.test/index.html?x=1');
  const forwarded = await call(port, '/index.html', { 'X-Forwarded-Proto': 'https' });
  assert.equal(forwarded.statusCode, 200);
  assert.match(forwarded.headers['strict-transport-security'], /max-age/);
  const health = await call(port, '/api/health');
  assert.equal(health.statusCode, 200);
});

test('forged forwarded headers are ignored unless TRUST_PROXY is enabled', () => {
  const { isSecureRequest } = require('../lib/security');
  const request = { socket: {}, headers: { 'x-forwarded-proto': 'https' } };
  assert.equal(isSecureRequest(request), true);
  process.env.TRUST_PROXY = 'false';
  assert.equal(isSecureRequest(request), false);
});
