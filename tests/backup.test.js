'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createBackup } = require('../lib/backup');

test('backup creates a verified SQLite snapshot', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-backup-test-'));
  const db = new DatabaseSync(path.join(temp, 'source.sqlite'));
  try {
    db.exec("CREATE TABLE example(value TEXT); INSERT INTO example VALUES ('kept');");
    const file = createBackup(db, { root: temp, keep: 2 });
    assert.equal(fs.existsSync(file), true);
    const snapshot = new DatabaseSync(file, { readOnly: true });
    try { assert.equal(snapshot.prepare('SELECT value FROM example').get().value, 'kept'); }
    finally { snapshot.close(); }
  } finally {
    db.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
