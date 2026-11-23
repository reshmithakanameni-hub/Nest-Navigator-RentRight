'use strict';
// Route-by-route integration tests: every endpoint is checked for access control,
// method handling, validation and its happy path using a Supertest-style helper.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-routes-'));
process.env.DB_PATH = path.join(temp, 'routes.sqlite');
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_PER_MINUTE = '2000';
process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '50';
const { server, db } = require('../server');
const request = require('./helpers/request');
const api = request(server);
const PASSWORD = 'SecureDemo1234';
let tenant = '', owner = '', otherOwner = '';

async function account(name, email, role) {
  await api.post('/api/auth/register').send({ name, email, password: PASSWORD, role }).expect(201);
  const login = await api.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return login.headers['set-cookie'].split(';')[0];
}
const visit = (overrides = {}) => ({ propertyId: 2, name: 'Route Tester', email: 'route@example.test', date: '2099-03-01', time: '10:00 AM', ...overrides });

before(async () => {
  tenant = await account('Route Tenant', 'tenant@routes.test', 'tenant');
  owner = await account('Route Owner', 'owner@routes.test', 'owner');
  otherOwner = await account('Other Owner', 'other@routes.test', 'owner');
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
});

test('public GET endpoints respond with JSON and security headers', async () => {
  const routes = ['/api/health', '/api/properties', '/api/properties/1/insight', '/api/properties/compare?ids=1,2',
    '/api/recommendations?budget=30000&bhk=2', '/api/neighborhoods', '/api/neighborhoods/Kondapur',
    '/api/tools/affordability?rent=1000&deposit=1000&maintenance=0&income=9000',
    '/api/tools/commute?propertyId=1&mode=walk&destination=Office'];
  for (const route of routes) {
    await api.get(route).expect(200, result => {
      assert.match(result.headers['content-type'], /application\/json/, route);
      assert.equal(result.headers['x-content-type-options'], 'nosniff', route);
      assert.equal(result.headers['cache-control'], 'no-store', route);
    });
  }
});

test('protected endpoints return 401 without a session', async () => {
  await api.get('/api/auth/me').expect(401);
  await api.get('/api/shortlist').expect(401);
  await api.post('/api/shortlist').send({ propertyId: 1 }).expect(401);
  await api.delete('/api/shortlist/1').expect(401);
  await api.get('/api/owner/visits').expect(401);
  await api.post('/api/owner/properties/claim').send({ propertyId: 1 }).expect(401);
  await api.patch('/api/owner/visits/00000000-0000-0000-0000-000000000000').send({ status: 'CONFIRMED' }).expect(401);
});

test('owner endpoints return 403 for tenants and reject forged cookies', async () => {
  await api.get('/api/owner/visits').set('Cookie', tenant).expect(403);
  await api.post('/api/owner/properties/claim').set('Cookie', tenant).send({ propertyId: 1 }).expect(403);
  await api.get('/api/owner/visits').set('Cookie', 'nn_session=forged').expect(401);
});

test('unknown routes and unsupported methods are rejected', async () => {
  await api.get('/api/nope').expect(404);
  await api.put('/api/properties').send({}).expect(404);
  await api.post('/index.html').send({}).expect(405);
  await api.get('/api/visits').expect(404);
});

test('registration, login and /me validate input and never leak secrets', async () => {
  const bad = [
    { name: 'A', email: 'a@x.test', password: PASSWORD, role: 'tenant' },
    { name: 'Valid Name', email: 'not-an-email', password: PASSWORD, role: 'tenant' },
    { name: 'Valid Name', email: 'v@x.test', password: 'short1', role: 'tenant' },
    { name: 'Valid Name', email: 'v@x.test', password: 'lettersonlylettersonly', role: 'tenant' },
    { name: 'Valid Name', email: 'v@x.test', password: PASSWORD, role: 'admin' }
  ];
  for (const body of bad) await api.post('/api/auth/register').send(body).expect(400);
  await api.post('/api/auth/register').send({ name: 'Dup', email: 'tenant@routes.test', password: PASSWORD, role: 'tenant' }).expect(409);
  await api.post('/api/auth/login').send({ email: 'tenant@routes.test', password: 'WrongPassword1' }).expect(401);
  await api.get('/api/auth/me').set('Cookie', tenant).expect(200, result => {
    assert.deepEqual(Object.keys(result.body.user).sort(), ['email', 'id', 'name', 'role']);
    assert.ok(!result.text.includes('hash') && !result.text.includes('salt'));
  });
});

test('visit requests validate input and the database rejects double-booked slots', async () => {
  await api.post('/api/visits').send(visit({ email: 'bad' })).expect(400);
  await api.post('/api/visits').send(visit({ date: '2001-01-01' })).expect(400);
  await api.post('/api/visits').send(visit({ time: '3:33 AM' })).expect(400);
  await api.post('/api/visits').send(visit({ propertyId: 9999 })).expect(404);
  const first = await api.post('/api/visits').send(visit()).expect(201);
  await api.post('/api/visits').send(visit({ email: 'second@example.test' })).expect(409);
  await api.post('/api/visits').send(visit({ time: '11:00 AM' })).expect(201);
  await api.post('/api/owner/properties/claim').set('Cookie', owner).send({ propertyId: 2 }).expect(200);
  await api.patch(`/api/owner/visits/${first.body.id}`).set('Cookie', owner).send({ status: 'DECLINED' }).expect(200);
  await api.post('/api/visits').send(visit({ email: 'third@example.test' })).expect(201);
});

test('claims and visit updates are limited to the owning account', async () => {
  await api.post('/api/owner/properties/claim').set('Cookie', otherOwner).send({ propertyId: 2 }).expect(409);
  await api.post('/api/owner/properties/claim').set('Cookie', otherOwner).send({ propertyId: 'x' }).expect(400);
  const mine = await api.get('/api/owner/visits').set('Cookie', owner).expect(200);
  assert.ok(mine.body.visits.length >= 2);
  assert.ok(mine.body.visits.every(v => /^.\*\*\*@/.test(v.email)));
  const target = mine.body.visits[0].id;
  await api.patch(`/api/owner/visits/${target}`).set('Cookie', otherOwner).send({ status: 'CONFIRMED' }).expect(404);
  await api.patch(`/api/owner/visits/${target}`).set('Cookie', owner).send({ status: 'REQUESTED' }).expect(400);
  await api.patch(`/api/owner/visits/${target}`).set('Cookie', owner).send({ status: 'COMPLETED' }).expect(200);
});

test('shortlist add, duplicate add, remove and unknown listing behave correctly', async () => {
  await api.post('/api/shortlist').set('Cookie', tenant).send({ propertyId: 3 }).expect(201, r => assert.deepEqual(r.body.propertyIds, [3]));
  await api.post('/api/shortlist').set('Cookie', tenant).send({ propertyId: 3 }).expect(201, r => assert.deepEqual(r.body.propertyIds, [3]));
  await api.post('/api/shortlist').set('Cookie', tenant).send({ propertyId: 999 }).expect(400);
  await api.get('/api/shortlist').set('Cookie', owner).expect(200, r => assert.deepEqual(r.body.propertyIds, []));
  await api.delete('/api/shortlist/3').set('Cookie', tenant).expect(200, r => assert.deepEqual(r.body.propertyIds, []));
});

test('malformed and oversized request bodies are rejected before reaching handlers', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const malformed = await fetch(`${base}/api/visits`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: '{bad json' });
  assert.equal(malformed.status, 400);
  await api.post('/api/visits').send({ name: 'x'.repeat(20000) }).expect(413);
  const foreign = await fetch(`${base}/api/visits`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
  assert.equal(foreign.status, 403);
});
