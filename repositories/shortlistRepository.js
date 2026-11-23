'use strict';
const { db } = require('../lib/database');
function propertyExists(id) { return !!db.prepare('SELECT id FROM properties WHERE id=?').get(id); }
function list(userId) { return db.prepare('SELECT property_id FROM shortlists WHERE user_id=? ORDER BY created_at DESC').all(userId).map(row => row.property_id); }
function add(userId, propertyId) { db.prepare('INSERT OR IGNORE INTO shortlists(user_id,property_id,created_at) VALUES(?,?,?)').run(userId, propertyId, new Date().toISOString()); }
function remove(userId, propertyId) { db.prepare('DELETE FROM shortlists WHERE user_id=? AND property_id=?').run(userId, propertyId); }
module.exports = { propertyExists, list, add, remove };
