'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-concurrency-'));
process.env.DB_PATH = path.join(temp, 'concurrency.sqlite');
process.env.NODE_ENV = 'test';
const { db } = require('../lib/database');
const WORKERS = 6;

for (let worker = 0; worker < WORKERS; worker++) {
  const stamp = new Date().toISOString();
  db.prepare("INSERT INTO users(id,name,email,role,salt,password_hash,created_at) VALUES(?,?,?,?,'s','h',?)")
    .run(`owner-${worker}`, `Owner ${worker}`, `owner${worker}@example.test`, 'owner', stamp);
  db.prepare("INSERT INTO users(id,name,email,role,salt,password_hash,created_at) VALUES(?,?,?,?,'s','h',?)")
    .run(`user-${worker}`, `User ${worker}`, `user${worker}@example.test`, 'tenant', stamp);
}
after(() => { db.close(); fs.rmSync(temp, { recursive: true, force: true }); });

function runWorker(index) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'helpers', 'concurrency-worker.js'), String(index)],
      { env: { ...process.env, DB_PATH: process.env.DB_PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`worker ${index} exited ${code}: ${err}`));
      resolve(JSON.parse(out));
    });
  });
}

test('concurrent processes share one SQLite file without lost or duplicated writes', async () => {
  const results = await Promise.all(Array.from({ length: WORKERS }, (_, index) => runWorker(index)));

  assert.deepEqual(results.flatMap(r => r.errors), [], 'no SQLITE_BUSY or other unexpected errors');
  assert.equal(results.reduce((sum, r) => sum + r.claimWins, 0), 1, 'exactly one process wins the listing claim');
  assert.equal(results.reduce((sum, r) => sum + r.slotWins, 0), 20, 'one booking succeeds per contested slot');
  assert.equal(results.reduce((sum, r) => sum + r.slotConflicts, 0), 20 * (WORKERS - 1), 'every other booking is a clean 409');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM visits').get().n, 20);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM properties WHERE owner_id IS NOT NULL').get().n, 1);
  // 12 distinct listings per user (rounds 0-19 wrap) -> rows are unique per (user, property).
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shortlists').get().n, WORKERS * 12);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
