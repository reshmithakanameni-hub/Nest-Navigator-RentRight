'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-test-'));
process.env.DB_PATH = path.join(temp, 'test.sqlite');
process.env.NODE_ENV = 'test';
const { server, db } = require('../server');
let baseUrl;
let ownerCookie = '';
let tenantCookie = '';
let secondOwnerCookie = '';
let visitId = '';

before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
});
async function request(route, options = {}) {
  const response = await fetch(baseUrl + route, {
    ...options,
    headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), Origin: baseUrl, ...(options.headers || {}) }
  });
  const body = await response.json();
  return { response, body };
}
async function register(name, email, role) {
  return request('/api/auth/register', {
    method:'POST',
    body:JSON.stringify({name,email,password:'SecureDemo1234',role})
  });
}
async function login(email) {
  const result = await request('/api/auth/login', {
    method:'POST', body:JSON.stringify({email,password:'SecureDemo1234'})
  });
  return { ...result, cookie:result.response.headers.get('set-cookie')?.split(';')[0] || '' };
}

test('health and listing endpoints use SQLite and return seeded records', async () => {
  const health = await request('/api/health');
  assert.equal(health.response.status,200);
  assert.equal(health.body.storage,'sqlite');
  assert.equal(health.body.database,'ok');
  const listings = await request('/api/properties');
  assert.equal(listings.response.status,200);
  assert.equal(listings.body.total,12);
  const filtered = await request('/api/properties?maxRent=20000&bhk=2');
  assert.ok(filtered.body.properties.length >= 1);
  assert.ok(filtered.body.properties.every(p => p.rent <= 20000 && p.bhk === 2));
});

test('security headers, hostile origins, malformed JSON and oversized bodies are handled', async () => {
  const health = await request('/api/health');
  assert.equal(health.response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.response.headers.get('x-frame-options'), 'DENY');
  const hostile = await request('/api/auth/logout', { method:'POST', headers:{ Origin:'https://attacker.invalid' } });
  assert.equal(hostile.response.status, 403);
  const malformed = await request('/api/visits', { method:'POST', body:'{' });
  assert.equal(malformed.response.status, 400);
  const oversized = await request('/api/visits', { method:'POST', body:JSON.stringify({ payload:'x'.repeat(13000) }) });
  assert.equal(oversized.response.status, 413);
  for (const privatePath of ['/server.js', '/lib/database.js', '/.env.example', '/data/nestnavigator.sqlite']) {
    const response = await fetch(baseUrl + privatePath);
    assert.equal(response.status, 404, `${privatePath} must not be served as a static asset`);
  }
});


test('smart recommendations rank properties and validate preferences', async () => {
  const invalid = await request('/api/recommendations?budget=0&bhk=2');
  assert.equal(invalid.response.status,400);
  const result = await request('/api/recommendations?budget=30000&bhk=2&area=Gachibowli&pets=true&parking=true');
  assert.equal(result.response.status,200);
  assert.ok(result.body.matches.length > 0);
  assert.ok(result.body.matches.length <= 5);
  assert.ok(result.body.matches.every(p => p.matchScore >= 0 && p.matchScore <= 100));
  assert.ok(result.body.matches[0].matchScore >= result.body.matches.at(-1).matchScore);
  assert.ok(Array.isArray(result.body.matches[0].matchReasons));
  assert.equal(result.body.matches.find(property => property.id === 4).matchScore, 90);
});

test('registration validates fields and rejects duplicate emails', async () => {
  const invalid = await request('/api/auth/register',{method:'POST',body:JSON.stringify({name:'A',email:'bad',password:'123',role:'owner'})});
  assert.equal(invalid.response.status,400);
  const created = await register('Demo Owner','owner@example.test','owner');
  assert.equal(created.response.status,201);
  const duplicate = await register('Demo Owner','OWNER@example.test','owner');
  assert.equal(duplicate.response.status,409);
  const tenant = await register('Demo Tenant','tenant@example.test','tenant');
  assert.equal(tenant.response.status,201);
  const otherOwner = await register('Other Owner','other-owner@example.test','owner');
  assert.equal(otherOwner.response.status,201);
});

test('login creates a session and private endpoints enforce authentication and roles', async () => {
  const denied = await request('/api/owner/visits');
  assert.equal(denied.response.status,401);
  const owner = await login('owner@example.test');
  assert.equal(owner.response.status,200);
  ownerCookie = owner.cookie;
  const tenant = await login('tenant@example.test');
  assert.equal(tenant.response.status,200);
  tenantCookie = tenant.cookie;
  const otherOwner = await login('other-owner@example.test');
  secondOwnerCookie = otherOwner.cookie;
  const forbidden = await request('/api/owner/visits',{headers:{Cookie:tenantCookie}});
  assert.equal(forbidden.response.status,403);
  const me = await request('/api/auth/me',{headers:{Cookie:ownerCookie}});
  assert.equal(me.body.user.role,'owner');
  const missingOrigin = await request('/api/owner/properties/claim', {
    method:'POST', headers:{Cookie:ownerCookie, Origin:''}, body:JSON.stringify({propertyId:11})
  });
  assert.equal(missingOrigin.response.status,403);
});

test('owners can claim a listing and only manage requests for their own listing', async () => {
  const claimed = await request('/api/owner/properties/claim',{
    method:'POST',headers:{Cookie:ownerCookie},body:JSON.stringify({propertyId:4})
  });
  assert.equal(claimed.response.status,200);
  const competingClaim = await request('/api/owner/properties/claim',{
    method:'POST',headers:{Cookie:secondOwnerCookie},body:JSON.stringify({propertyId:4})
  });
  assert.equal(competingClaim.response.status,409);
  const visit = await request('/api/visits',{
    method:'POST',
    body:JSON.stringify({propertyId:4,name:'Visitor Demo',email:'visitor@example.test',date:'2099-05-20',time:'11:00 AM'})
  });
  assert.equal(visit.response.status,201);
  visitId = visit.body.id;
  const ownerVisits = await request('/api/owner/visits',{headers:{Cookie:ownerCookie}});
  assert.equal(ownerVisits.response.status,200);
  assert.equal(ownerVisits.body.visits.length,1);
  assert.equal(ownerVisits.body.visits[0].email,'v***@example.test');
  const otherOwnersVisits = await request('/api/owner/visits',{headers:{Cookie:secondOwnerCookie}});
  assert.equal(otherOwnersVisits.body.visits.length,0);
  const cannotUpdateAnotherOwnersVisit = await request(`/api/owner/visits/${visitId}`,{
    method:'PATCH',headers:{Cookie:secondOwnerCookie},body:JSON.stringify({status:'DECLINED'})
  });
  assert.equal(cannotUpdateAnotherOwnersVisit.response.status,404);
  const updated = await request(`/api/owner/visits/${visitId}`,{
    method:'PATCH',headers:{Cookie:ownerCookie},body:JSON.stringify({status:'CONFIRMED'})
  });
  assert.equal(updated.response.status,200);
  const badStatus = await request(`/api/owner/visits/${visitId}`,{
    method:'PATCH',headers:{Cookie:ownerCookie},body:JSON.stringify({status:'HACKED'})
  });
  assert.equal(badStatus.response.status,400);
});

test('shortlists are authenticated and isolated by user', async () => {
  const denied = await request('/api/shortlist');
  assert.equal(denied.response.status,401);
  const added = await request('/api/shortlist',{
    method:'POST',headers:{Cookie:tenantCookie},body:JSON.stringify({propertyId:4})
  });
  assert.equal(added.response.status,201);
  assert.deepEqual(added.body.propertyIds,[4]);
  const ownerList = await request('/api/shortlist',{headers:{Cookie:ownerCookie}});
  assert.deepEqual(ownerList.body.propertyIds,[]);
  const removed = await request('/api/shortlist/4',{method:'DELETE',headers:{Cookie:tenantCookie}});
  assert.deepEqual(removed.body.propertyIds,[]);
});

test('logout invalidates the session', async () => {
  const logout = await request('/api/auth/logout',{method:'POST',headers:{Cookie:ownerCookie}});
  assert.equal(logout.response.status,200);
  const me = await request('/api/auth/me',{headers:{Cookie:ownerCookie}});
  assert.equal(me.response.status,401);
});

test('password change verifies the current password, rotates the hash and revokes old sessions', async () => {
  await register('Pw User', 'pw@example.test', 'tenant');
  const first = await login('pw@example.test');
  const second = await login('pw@example.test');
  const anon = await request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'SecureDemo1234', newPassword: 'NewSecure5678' }) });
  assert.equal(anon.response.status, 401);
  const wrong = await request('/api/auth/change-password', { method: 'POST', headers: { Cookie: first.cookie }, body: JSON.stringify({ currentPassword: 'WrongPassword1', newPassword: 'NewSecure5678' }) });
  assert.equal(wrong.response.status, 401);
  const weak = await request('/api/auth/change-password', { method: 'POST', headers: { Cookie: first.cookie }, body: JSON.stringify({ currentPassword: 'SecureDemo1234', newPassword: 'short' }) });
  assert.equal(weak.response.status, 400);
  const changed = await request('/api/auth/change-password', { method: 'POST', headers: { Cookie: first.cookie }, body: JSON.stringify({ currentPassword: 'SecureDemo1234', newPassword: 'NewSecure5678' }) });
  assert.equal(changed.response.status, 200);
  const newCookie = changed.response.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/auth/me', { headers: { Cookie: first.cookie } })).response.status, 401);
  assert.equal((await request('/api/auth/me', { headers: { Cookie: second.cookie } })).response.status, 401);
  assert.equal((await request('/api/auth/me', { headers: { Cookie: newCookie } })).response.status, 200);
  const oldLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'pw@example.test', password: 'SecureDemo1234' }) });
  assert.equal(oldLogin.response.status, 401);
  const newLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'pw@example.test', password: 'NewSecure5678' }) });
  assert.equal(newLogin.response.status, 200);
});

test('login endpoint applies a persisted per-minute brute-force limit', async () => {
  let last;
  for (let i = 0; i < 14; i++) last = await request('/api/auth/login', {
    method:'POST', body:JSON.stringify({ email:`missing-${i}@example.test`, password:'WrongPassword123' })
  });
  assert.equal(last.response.status, 429);
  assert.equal(last.response.headers.get('retry-after'), '60');
});
