'use strict';
const { db } = require('../lib/database');
function create(tokenHash, userId, expiresAt) {
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash, userId, expiresAt);
}
function findValid(tokenHash, now = Date.now()) {
  const row = db.prepare(`SELECT u.id,u.name,u.email,u.role,s.expires_at AS expiresAt
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash, now);
  if (row) return { id: row.id, name: row.name, email: row.email, role: row.role };
  db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
  return null;
}
function remove(tokenHash) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash); }
function removeExpired(now = Date.now()) { return db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now).changes; }
function removeAllForUser(userId) { db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId); }
module.exports = { create, findValid, remove, removeExpired, removeAllForUser };
