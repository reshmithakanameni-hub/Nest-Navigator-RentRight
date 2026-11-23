'use strict';
const { db } = require('../lib/database');
function propertyExists(id) { return !!db.prepare('SELECT id FROM properties WHERE id=?').get(id); }
function create(visit) {
  db.prepare('INSERT INTO visits(id,property_id,name,email,visit_date,visit_time,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(visit.id, visit.propertyId, visit.name, visit.email, visit.date, visit.time, new Date().toISOString());
}
function listForOwner(ownerId) {
  return db.prepare(`SELECT v.id,v.name,v.email,v.visit_date AS date,v.visit_time AS time,v.status,p.name AS property
    FROM visits v JOIN properties p ON p.id=v.property_id WHERE p.owner_id=? ORDER BY v.created_at DESC`).all(ownerId);
}
function findOwned(id, ownerId) {
  return db.prepare('SELECT v.id FROM visits v JOIN properties p ON p.id=v.property_id WHERE v.id=? AND p.owner_id=?').get(id, ownerId);
}
function updateStatus(id, status) { db.prepare('UPDATE visits SET status=?,updated_at=? WHERE id=?').run(status, new Date().toISOString(), id); }
module.exports = { propertyExists, create, listForOwner, findOwned, updateStatus };
