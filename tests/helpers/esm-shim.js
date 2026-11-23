'use strict';
// The browser modules are ES modules; this shim re-implements nothing - it extracts the pure
// function from public/js/mapSearch.js so CommonJS tests can exercise the real source.
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'mapSearch.js'), 'utf8');
const match = /export function buildNearbyQuery[\s\S]*?\n}\n/.exec(source);
const buildNearbyQuery = new Function(`${match[0].replace('export ', '')}; return buildNearbyQuery;`)();
module.exports = { buildNearbyQuery };
