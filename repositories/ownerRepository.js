'use strict';
const { db } = require('../lib/database');
function claim(ownerId, propertyId) {
  return db.prepare('UPDATE properties SET owner_id=? WHERE id=? AND owner_id IS NULL').run(ownerId, propertyId).changes;
}
module.exports = { claim };
