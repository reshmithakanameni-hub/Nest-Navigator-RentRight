'use strict';
const service = require('../services/shortlistService');
const { requireUser } = require('../middleware/auth');
const { send } = require('../lib/http');
function currentUser(req, res) { return requireUser(req, res); }
function list(req, res) { const user = currentUser(req, res); if (user) send(res, 200, { propertyIds: service.list(user.id) }); }
async function add(req, res, readBody) {
  const user = currentUser(req, res); if (!user) return;
  try { send(res, 201, { propertyIds: service.add(user.id, (await readBody(req)).propertyId) }); }
  catch (error) { send(res, error.status || 400, { error: error.message }); }
}
function remove(req, res, id) { const user = currentUser(req, res); if (user) send(res, 200, { propertyIds: service.remove(user.id, id) }); }
module.exports = { list, add, remove };
