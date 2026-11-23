'use strict';
const fs = require('node:fs');
const path = require('node:path');
function createBackup(db, { root, directory, keep = 7 } = {}) {
  const destDir = path.resolve(directory || path.join(root, 'backups'));
  fs.mkdirSync(destDir, { recursive: true });
  const name = `nestnavigator-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
  const destination = path.join(destDir, name);
  const integrity = db.prepare('PRAGMA quick_check').get().quick_check;
  if (integrity !== 'ok') throw new Error(`Refusing backup: quick_check returned ${integrity}`);
  db.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
  const check = new (require('node:sqlite').DatabaseSync)(destination, { readOnly: true });
  try {
    if (check.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Backup verification failed.');
  } finally { check.close(); }
  const files = fs.readdirSync(destDir).filter(file => /^nestnavigator-.*\.sqlite$/.test(file)).sort().reverse();
  for (const old of files.slice(Math.max(1, keep))) fs.rmSync(path.join(destDir, old));
  return destination;
}
module.exports = { createBackup };
