'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-tools-'));
process.env.DB_PATH = path.join(temp, 'tools.sqlite');
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_PER_MINUTE = '1000';
const { server, db } = require('../server');
let baseUrl;

before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
});
async function get(route) {
  const response = await fetch(baseUrl + route, { headers: { Origin: baseUrl } });
  return { status: response.status, body: await response.json() };
}
async function post(route, body, cookie = '') {
  const response = await fetch(baseUrl + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseUrl, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json(), response };
}

test('server-side filters support furnishing, area text and sorting', async () => {
  const furnished = await get('/api/properties?furnishing=Furnished');
  assert.ok(furnished.body.properties.length > 0);
  assert.ok(furnished.body.properties.every(p => p.furnishing === 'Furnished'));
  const ignored = await get('/api/properties?furnishing=Hacked%27%20OR%201%3D1');
  assert.equal(ignored.body.total, 12);
  const low = await get('/api/properties?sort=low');
  const rents = low.body.properties.map(p => p.rent);
  assert.deepEqual(rents, [...rents].sort((a, b) => a - b));
  const high = await get('/api/properties?sort=high');
  assert.equal(high.body.properties[0].rent, 42000);
  const search = await get('/api/properties?area=gachibowli');
  assert.equal(search.body.total, 1);
});

test('affordability calculation runs on the server and validates input', async () => {
  const ok = await get('/api/tools/affordability?rent=25000&deposit=100000&maintenance=3000&income=75000');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.moveInCost, 128000);
  assert.equal(ok.body.ratioPercent, 37);
  assert.equal(ok.body.withinGuideline, false);
  const comfortable = await get('/api/tools/affordability?rent=15000&deposit=0&maintenance=0&income=100000');
  assert.equal(comfortable.body.withinGuideline, true);
  const noIncome = await get('/api/tools/affordability?rent=1000&deposit=1&maintenance=1');
  assert.equal(noIncome.body.ratioPercent, null);
  for (const bad of ['rent=-5', 'rent=abc', 'rent=999999999999', 'income=-1']) {
    assert.equal((await get(`/api/tools/affordability?${bad}`)).status, 400, bad);
  }
});

test('neighborhood scorecard and commute estimate validate their inputs', async () => {
  const list = await get('/api/neighborhoods');
  assert.ok(list.body.neighborhoods.includes('Gachibowli'));
  const scores = await get('/api/neighborhoods/Gachibowli');
  assert.equal(scores.body.scores.length, 4);
  assert.equal((await get('/api/neighborhoods/Atlantis')).status, 404);
  const commute = await get('/api/tools/commute?propertyId=1&mode=transit&destination=HITEC%20City');
  assert.equal(commute.body.minutes, 32);
  assert.equal((await get('/api/tools/commute?propertyId=1&mode=rocket&destination=X')).status, 400);
  assert.equal((await get('/api/tools/commute?propertyId=1&mode=car&destination=')).status, 400);
  assert.equal((await get('/api/tools/commute?propertyId=999&mode=car&destination=X')).status, 404);
});

test('comparison endpoint needs two or three real homes and flags the cheapest', async () => {
  const result = await get('/api/properties/compare?ids=1,4,10');
  assert.equal(result.status, 200);
  assert.equal(result.body.properties.length, 3);
  assert.equal(result.body.lowestMonthlyCostId, 10);
  assert.equal((await get('/api/properties/compare?ids=1')).status, 400);
  assert.equal((await get('/api/properties/compare?ids=1,2,3,4')).status, 400);
  assert.equal((await get('/api/properties/compare?ids=1,999')).status, 404);
});

test('price insight compares a listing with the city median', async () => {
  const insight = await get('/api/properties/11/insight');
  assert.equal(insight.status, 200);
  assert.ok(['ABOVE_MARKET', 'BELOW_MARKET', 'FAIR'].includes(insight.body.verdict));
  assert.ok(insight.body.cityMedianPerSqft > 0);
  assert.equal((await get('/api/properties/999/insight')).status, 404);
});

test('security events are written to the audit log without secrets', async () => {
  const email = 'audit@example.test';
  await post('/api/auth/register', { name: 'Audit User', email, password: 'SecureDemo1234', role: 'tenant' });
  await post('/api/auth/login', { email, password: 'WrongPassword999' });
  const login = await post('/api/auth/login', { email, password: 'SecureDemo1234' });
  assert.equal(login.status, 200);
  const events = db.prepare('SELECT event,detail FROM audit_log ORDER BY id').all().map(row => row.event);
  assert.deepEqual(events, ['REGISTER', 'LOGIN_FAILED', 'LOGIN']);
  const serialized = JSON.stringify(db.prepare('SELECT * FROM audit_log').all());
  assert.ok(!serialized.includes('SecureDemo1234') && !serialized.includes('WrongPassword999'));
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 6);
});

test('security headers and static file allow-list protect source and data', async () => {
  for (const blocked of ['/server.js', '/lib/database.js', '/data/nestnavigator.sqlite', '/package.json', '/.env', '/%2e%2e/etc/passwd']) {
    const response = await fetch(baseUrl + blocked);
    assert.ok([403, 404].includes(response.status), `${blocked} -> ${response.status}`);
  }
  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
});
