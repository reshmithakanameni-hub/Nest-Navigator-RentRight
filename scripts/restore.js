'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || '');
const target = path.resolve(process.env.DB_PATH || path.join(root, 'data', 'nestnavigator.sqlite'));
if (!process.argv[2] || !fs.existsSync(source)) throw new Error('Usage: node scripts/restore.js <verified-backup.sqlite>');
const check = new DatabaseSync(source, { readOnly: true });
try {
  if (check.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Backup failed SQLite integrity check.');
} finally { check.close(); }
if (fs.existsSync(target)) {
  const before = new DatabaseSync(target);
  try {
    const safe = path.join(path.dirname(target), `pre-restore-${Date.now()}.sqlite`);
    before.exec(`VACUUM INTO '${safe.replace(/'/g, "''")}'`);
    console.log(`Current database preserved at ${safe}`);
  } finally { before.close(); }
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Restored verified backup to ${target}. Restart the server to reopen it.`);
