'use strict';
// A small Supertest-compatible helper: request(server).get(url).set(k, v).send(body).expect(status).
// It mirrors the Supertest API used in these tests, so `require('supertest')` is a drop-in replacement
// where npm packages can be installed.
const assert = require('node:assert/strict');

class Pending {
  constructor(server, method, url) {
    this.server = server; this.method = method; this.url = url;
    this.headers = {}; this.payload = undefined; this.checks = [];
  }
  set(name, value) { this.headers[name] = value; return this; }
  send(body) { this.payload = body; return this; }
  expect(status, body) { this.checks.push({ status, body }); return this; }

  async run() {
    if (!this.server.listening) await new Promise(resolve => this.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${this.server.address().port}`;
    const headers = { Origin: base, ...this.headers };
    if (this.payload !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + this.url, {
      method: this.method, headers,
      body: this.payload === undefined ? undefined : JSON.stringify(this.payload)
    });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    const result = { status: response.status, body, text, headers: Object.fromEntries(response.headers) };
    for (const check of this.checks) {
      assert.equal(result.status, check.status, `${this.method} ${this.url} -> ${result.status} ${text.slice(0, 120)}`);
      if (typeof check.body === 'function') check.body(result);
      else if (check.body !== undefined) assert.deepEqual(result.body, check.body);
    }
    return result;
  }
  then(resolve, reject) { return this.run().then(resolve, reject); }
}

module.exports = server => ({
  get: url => new Pending(server, 'GET', url),
  post: url => new Pending(server, 'POST', url),
  patch: url => new Pending(server, 'PATCH', url),
  delete: url => new Pending(server, 'DELETE', url),
  put: url => new Pending(server, 'PUT', url)
});
