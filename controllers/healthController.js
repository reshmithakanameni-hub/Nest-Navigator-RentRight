'use strict';
const { db } = require('../lib/database');
const { send } = require('../lib/http');
function health(res) {
  try {
    const integrity = db.prepare('PRAGMA quick_check').get().quick_check;
    send(res, integrity === 'ok' ? 200 : 503, { status: integrity === 'ok' ? 'ok' : 'degraded', service: 'NestNavigator API', storage: 'sqlite', database: integrity, properties: db.prepare('SELECT COUNT(*) AS n FROM properties').get().n });
  } catch { send(res, 503, { status: 'degraded', error: 'Database health check failed.' }); }
}
module.exports = { health };
