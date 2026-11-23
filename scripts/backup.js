'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const source = path.resolve(process.env.DB_PATH || path.join(root, 'data', 'nestnavigator.sqlite'));
const destinationDir = path.resolve(process.env.BACKUP_DIR || path.join(root, 'backups'));
const keep = Math.max(1, Math.min(100, Number(process.env.BACKUP_KEEP || 7)));
if (!fs.existsSync(source)) throw new Error(`Database does not exist: ${source}`);
fs.mkdirSync(destinationDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(destinationDir, `nestnavigator-${stamp}.sqlite`);
const db = new DatabaseSync(source);
try {
  const integrity = db.prepare('PRAGMA quick_check').get().quick_check;
  if (integrity !== 'ok') throw new Error(`Refusing backup: quick_check returned ${integrity}`);
  db.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
} finally { db.close(); }
const backup = new DatabaseSync(destination, { readOnly: true });
try {
  if (backup.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Backup verification failed.');
} finally { backup.close(); }
const files = fs.readdirSync(destinationDir).filter(name => /^nestnavigator-.*\.sqlite$/.test(name))
  .sort().reverse();
for (const old of files.slice(keep)) fs.rmSync(path.join(destinationDir, old));
console.log(`Verified SQLite backup created: ${destination}`);
