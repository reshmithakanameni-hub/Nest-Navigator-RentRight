'use strict';
const { db } = require('../lib/database');

// Append-only security audit trail. Details never contain passwords or tokens.
function record(event, actorId = null, detail = '') {
  db.prepare('INSERT INTO audit_log(event,actor_id,detail,created_at) VALUES(?,?,?,?)')
    .run(event, actorId, String(detail).slice(0, 200), new Date().toISOString());
}

function recent(limit = 50) {
  return db.prepare('SELECT id,event,actor_id,detail,created_at FROM audit_log ORDER BY id DESC LIMIT ?')
    .all(Math.min(Math.max(Number(limit) || 50, 1), 200));
}

module.exports = { record, recent };
