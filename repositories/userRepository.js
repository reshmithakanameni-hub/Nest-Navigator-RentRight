'use strict';
const { db } = require('../lib/database');
function findByEmail(email) { return db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(email); }
function create(user) {
  db.prepare('INSERT INTO users(id,name,email,role,salt,password_hash,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(user.id, user.name, user.email, user.role, user.salt, user.passwordHash, new Date().toISOString());
}
function findById(id) { return db.prepare('SELECT * FROM users WHERE id=?').get(id); }
function updatePassword(id, salt, passwordHash) { db.prepare('UPDATE users SET salt=?,password_hash=? WHERE id=?').run(salt, passwordHash, id); }
module.exports = { findByEmail, findById, create, updatePassword };
