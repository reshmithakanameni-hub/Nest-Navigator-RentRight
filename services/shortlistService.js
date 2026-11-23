'use strict';
const repository = require('../repositories/shortlistRepository');
const { safeId } = require('../lib/validation');
function add(userId, rawId) {
  const id = safeId(rawId);
  if (!id || !repository.propertyExists(id)) throw Object.assign(new Error('Unknown property.'), { status: 400 });
  repository.add(userId, id);
  return repository.list(userId);
}
function remove(userId, rawId) { const id = safeId(rawId); if (id) repository.remove(userId, id); return repository.list(userId); }
module.exports = { list: repository.list, add, remove };
