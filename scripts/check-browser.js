'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = [path.join(root, 'app.js'), ...fs.readdirSync(path.join(root, 'public', 'js'))
  .filter(name => name.endsWith('.js')).map(name => path.join(root, 'public', 'js', name))];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(file), encoding: 'utf8' });
  if (result.status !== 0) { console.error(path.relative(root, file), result.stderr || result.error); process.exit(result.status || 1); }
}
console.log(`Syntax checked ${files.length} browser modules.`);
