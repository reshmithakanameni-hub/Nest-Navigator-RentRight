'use strict';
// Every operation documented in openapi.yaml must be routed, and every routed public path must be documented.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-openapi-'));
process.env.DB_PATH = path.join(temp, 'openapi.sqlite');
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_PER_MINUTE = '5000';
const { server, db } = require('../server');
const api = require('./helpers/request')(server);
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(temp, { recursive: true, force: true }); });

const spec = fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8');
const operations = [];
let current = null;
for (const line of spec.split('\n')) {
  const route = /^  (\/api\/\S+):\s*$/.exec(line);
  if (route) { current = route[1]; continue; }
  const method = /^    (get|post|patch|delete|put):\s*$/.exec(line);
  if (method && current) operations.push({ method: method[1], route: current });
}
const sample = route => route.replace('{id}', '1').replace('{area}', 'Gachibowli').replace('{propertyId}', '1');

test('the spec documents the expected number of operations', () => {
  assert.ok(operations.length >= 25, `found ${operations.length}`);
  assert.ok(spec.startsWith('openapi: 3.0.3'));
});

test('every documented operation is routed (never "API endpoint not found")', async () => {
  for (const { method, route } of operations) {
    const request = api[method](sample(route));
    const response = await (method === 'get' ? request : request.send({}));
    assert.notEqual(response.body && response.body.error, 'API endpoint not found.', `${method.toUpperCase()} ${route} is documented but not routed`);
    assert.notEqual(response.status, 405, `${method.toUpperCase()} ${route} returned 405`);
  }
});

test('undocumented methods stay closed', async () => {
  assert.equal((await api.get('/api/visits')).status, 404, 'listing visits publicly is not offered');
  assert.equal((await api.get('/api/not-a-route')).status, 404);
});

test('responses carry a request id', async () => {
  const response = await api.get('/api/health');
  assert.match(response.headers['x-request-id'], /^[0-9a-f-]{36}$/);
});
