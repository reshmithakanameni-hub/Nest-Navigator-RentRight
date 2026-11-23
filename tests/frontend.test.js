'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const moduleUrl = name => pathToFileURL(path.join(ROOT, 'public', 'js', name)).href;

test('buildQuery sends only meaningful filters to the API', async () => {
  const { buildQuery } = await import(moduleUrl('listings.js'));
  assert.equal(buildQuery({ maxRent: 999999, bhk: 0, furnishing: '', term: '  ', sort: 'featured' }), '');
  const params = new URLSearchParams(buildQuery({ maxRent: 20000, bhk: 2, furnishing: 'Furnished', term: ' Maple ', sort: 'low', pets: true, parking: true }));
  assert.equal(params.get('maxRent'), '20000');
  assert.equal(params.get('bhk'), '2');
  assert.equal(params.get('furnishing'), 'Furnished');
  assert.equal(params.get('area'), 'Maple');
  assert.equal(params.get('sort'), 'low');
  assert.equal(params.get('pets'), 'true');
  assert.equal(params.get('parking'), 'true');
});

test('lease helpers compute the 11-month term and escape user text', async () => {
  const { leaseEndDate, buildLeaseHTML } = await import(moduleUrl('lease.js'));
  assert.equal(leaseEndDate('2026-01-15'), '2026-12-15');
  const html = buildLeaseHTML({
    tenant: '<script>alert(1)</script>', startDate: '2026-01-15', preparedOn: '1/1/2026',
    property: { name: 'Maple', area: 'Gachibowli', city: 'Hyderabad', rent: 28000, deposit: 90000, maintenance: 2500 }
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('2026-12-15'));
});

test('comparison rows cover every listing attribute', async () => {
  const { comparisonRows } = await import(moduleUrl('compare.js'));
  assert.deepEqual(comparisonRows.map(row => row[0]), ['Area', 'Monthly rent', 'Deposit', 'BHK', 'Furnishing', 'Size', 'Maintenance', 'Pets', 'Parking']);
});

test('escapeHTML neutralises markup and money uses Indian grouping', async () => {
  const { escapeHTML, money } = await import(moduleUrl('format.js'));
  assert.equal(escapeHTML('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
  assert.equal(money(128000), '\u20b91,28,000');
});

// --- Browser smoke test with a tiny fake DOM, run against the real server. ---
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-ui-'));
process.env.DB_PATH = path.join(temp, 'ui.sqlite');
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_PER_MINUTE = '1000';
let server, db, baseUrl;
const realFetch = globalThis.fetch;

function fakeElement(defaults = {}) {
  const listeners = {};
  return {
    value: '', checked: false, hidden: false, textContent: '', innerHTML: '', min: '', dataset: {},
    style: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
    fire(type, event = {}) { (listeners[type] || []).forEach(handler => handler(event)); },
    scrollIntoView() {}, append() {}, ...defaults
  };
}

before(async () => {
  ({ server, db } = require('../server'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  globalThis.fetch = realFetch;
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
});

test('app.js loads listings from the API, filters server-side and requires sign-in to shortlist', async () => {
  const elements = new Map();
  const defaults = { maxRent: '999999', bhk: '0', sort: 'featured', rent: '25000', deposit: '100000', maintenance: '3000', income: '75000', neighborhood: 'Gachibowli', mode: 'car', authAction: 'register' };
  const get = key => {
    const id = key.replace(/^#/, '');
    if (!elements.has(id)) elements.set(id, fakeElement(id in defaults ? { value: defaults[id] } : {}));
    return elements.get(id);
  };
  const documentListeners = {};
  globalThis.document = {
    getElementById: get, querySelector: get, body: { style: {} },
    addEventListener(type, handler) { (documentListeners[type] ||= []).push(handler); }
  };
  globalThis.window = { print() {}, addEventListener() {} };
  globalThis.location = { hash: '', pathname: '/', search: '' };
  globalThis.history = { replaceState() {} };
  globalThis.fetch = (url, options) => realFetch(url.startsWith('/') ? baseUrl + url : url, { ...options, headers: { Origin: baseUrl, ...(options?.headers || {}) } });

  const source = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')
    .replaceAll('./public/js/', `${pathToFileURL(path.join(ROOT, 'public', 'js')).href}/`);
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const settle = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));
  await settle();

  const countCards = () => (get('propertyGrid').innerHTML.match(/class="property"/g) || []).length;
  assert.equal(countCards(), 12, 'initial listings come from /api/properties');
  assert.match(get('count').textContent, /Showing 12 of 12/);
  assert.match(get('total').textContent, /1,28,000/, 'move-in total comes from the server');
  assert.match(get('scores').innerHTML, /Groceries/);

  get('search').value = 'Gachibowli';
  get('search').fire('input');
  await settle(600);
  assert.equal(countCards(), 1, 'search is applied by the API');
  assert.match(get('count').textContent, /Showing 1 of 12/);

  get('search').value = '';
  get('sort').value = 'high';
  get('sort').fire('input');
  await settle(600);
  assert.match(get('propertyGrid').innerHTML.split('class="property"')[1], /Willow Court/, 'sorting is applied by the API');

  const heart = { dataset: { save: '1' } };
  documentListeners.click.forEach(handler => handler({
    target: { closest: selector => (selector === '[data-save]' ? heart : null) }
  }));
  await settle(200);
  assert.match(get('toast').textContent, /Sign in to save/, 'no localStorage fallback for signed-out visitors');
  assert.equal(get('shortlistGrid').innerHTML, '');
});
