'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-nearby-'));
process.env.DB_PATH = path.join(temp, 'nearby.sqlite');
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_PER_MINUTE = '5000';
const { server, db } = require('../server');
const { distanceKm } = require('../services/nearbyService');
const { buildNearbyQuery } = require('./helpers/esm-shim');
const api = require('./helpers/request')(server);
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(temp, { recursive: true, force: true }); });
before(() => {});

test('haversine distance is accurate for known city pairs', () => {
  const hyderabadToBengaluru = distanceKm(17.385, 78.4867, 12.9716, 77.5946);
  assert.ok(hyderabadToBengaluru > 495 && hyderabadToBengaluru < 515, `got ${hyderabadToBengaluru}`);
  assert.equal(distanceKm(17.4, 78.4, 17.4, 78.4), 0);
});

test('listings carry coordinates and landmarks are listed', async () => {
  const { body } = await api.get('/api/properties').expect(200);
  assert.ok(body.properties.every(home => typeof home.lat === 'number' && typeof home.lng === 'number'));
  const landmarks = await api.get('/api/landmarks').expect(200);
  assert.ok(landmarks.body.landmarks.length >= 5);
});

test('nearby search returns homes inside the radius, nearest first', async () => {
  const { body } = await api.get('/api/properties/nearby?lat=17.4504&lng=78.3810&radiusKm=4').expect(200);
  assert.ok(body.total >= 2);
  assert.ok(body.properties.every(home => home.distanceKm <= 4));
  const distances = body.properties.map(home => home.distanceKm);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
  assert.ok(body.properties.every(home => home.city === 'Hyderabad'), 'Bengaluru homes are far outside this circle');
  const filtered = await api.get('/api/properties/nearby?lat=17.4504&lng=78.3810&radiusKm=25&bhk=1&maxRent=15000').expect(200);
  assert.ok(filtered.body.properties.every(home => home.bhk === 1 && home.rent <= 15000));
});

test('nearby search validates coordinates and radius', async () => {
  await api.get('/api/properties/nearby?lat=abc&lng=78').expect(400);
  await api.get('/api/properties/nearby?lat=95&lng=78').expect(400);
  await api.get('/api/properties/nearby?lat=17&lng=78&radiusKm=0.1').expect(400);
  await api.get('/api/properties/nearby?lat=17&lng=78&radiusKm=500').expect(400);
  await api.get('/api/properties/nearby').expect(400);
});

test('browser query builder encodes filters', () => {
  assert.equal(buildNearbyQuery({ lat: 1, lng: 2, radiusKm: 5, maxRent: 999999, bhk: 0 }), 'lat=1&lng=2&radiusKm=5');
  assert.equal(buildNearbyQuery({ lat: 1, lng: 2, radiusKm: 5, maxRent: 20000, bhk: 2 }), 'lat=1&lng=2&radiusKm=5&maxRent=20000&bhk=2');
});
