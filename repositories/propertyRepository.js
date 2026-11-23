'use strict';
const { db } = require('../lib/database');

const COLUMNS = 'id,name,area,city,rent,deposit,bhk,furnishing,pets,parking,maintenance,size,image,description,lat,lng';
const FURNISHING = ['Furnished', 'Semi-furnished', 'Unfurnished'];
const SORTS = { low: 'rent ASC, id ASC', high: 'rent DESC, id ASC', featured: 'id ASC' };

const toProperty = row => ({ ...row, pets: !!row.pets, parking: !!row.parking });

function list(filters = {}) {
  let sql = `SELECT ${COLUMNS} FROM properties WHERE 1=1`;
  const args = [];
  if (filters.maxRent && Number.isFinite(Number(filters.maxRent)) && Number(filters.maxRent) > 0) {
    sql += ' AND rent <= ?'; args.push(Number(filters.maxRent));
  }
  if ([1, 2, 3].includes(Number(filters.bhk))) { sql += ' AND bhk = ?'; args.push(Number(filters.bhk)); }
  if (FURNISHING.includes(filters.furnishing)) { sql += ' AND furnishing = ?'; args.push(filters.furnishing); }
  if (filters.area) {
    sql += ' AND (LOWER(area) LIKE ? OR LOWER(city) LIKE ? OR LOWER(name) LIKE ?)';
    const q = `%${String(filters.area).slice(0, 80).toLowerCase()}%`; args.push(q, q, q);
  }
  if (filters.pets === 'true') sql += ' AND pets = 1';
  if (filters.parking === 'true') sql += ' AND parking = 1';
  const order = SORTS[filters.sort] || SORTS.featured;
  return db.prepare(`${sql} ORDER BY ${order}`).all(...args).map(toProperty);
}

function findById(id) {
  const row = db.prepare(`SELECT ${COLUMNS} FROM properties WHERE id = ?`).get(id);
  return row ? toProperty(row) : null;
}

function findByIds(ids) {
  return ids.map(findById).filter(Boolean);
}

// Median rent per square foot for a city, used by the price-insight service.
function rentPerSqftInCity(city) {
  return db.prepare('SELECT rent * 1.0 / size AS value FROM properties WHERE city = ? AND size > 0 ORDER BY value')
    .all(city).map(row => row.value);
}

module.exports = { list, findById, findByIds, rentPerSqftInCity };
