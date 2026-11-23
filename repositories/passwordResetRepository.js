'use strict';
const { db } = require('../lib/database');

function create(tokenHash, userId, expiresAt) {
  db.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash, userId, expiresAt);
}

// Atomically marks a token as used and returns its user id. A second call with the same
// token, an expired token or an unknown token returns null, so a link works only once.
function consume(tokenHash, now = Date.now()) {
  const row = db.prepare(`UPDATE password_resets SET used_at = ?
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id`).get(now, tokenHash, now);
  return row ? row.user_id : null;
}

function removeForUser(userId) { db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId); }
function removeExpired(now = Date.now()) { return db.prepare('DELETE FROM password_resets WHERE expires_at <= ?').run(now).changes; }

module.exports = { create, consume, removeForUser, removeExpired };
