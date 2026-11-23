'use strict';
const service = require('../services/ownerService');
const { requireUser } = require('../middleware/auth');
const { send } = require('../lib/http');
function owner(req, res) { return requireUser(req, res, 'owner'); }
async function claim(req, res, readBody) {
  const user = owner(req, res); if (!user) return;
  try { send(res, 200, service.claim(user.id, await readBody(req))); }
  catch (error) { send(res, error.status || 400, { error: error.message }); }
}
function visits(req, res) {
  const user = owner(req, res); if (!user) return;
  send(res, 200, { visits: service.visits(user.id) });
}
async function updateVisit(req, res, id, readBody) {
  const user = owner(req, res); if (!user) return;
  try { send(res, 200, service.updateVisit(user.id, id, (await readBody(req)).status)); }
  catch (error) { send(res, error.status || 400, { error: error.message }); }
}
module.exports = { claim, visits, updateVisit };
