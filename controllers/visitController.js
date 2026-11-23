'use strict';
const service = require('../services/visitService');
const { send } = require('../lib/http');
async function create(req, res, readBody) {
  try { send(res, 201, service.schedule(await readBody(req))); }
  catch (error) { send(res, error.status || 400, { error: error.message || 'Could not submit visit request.' }); }
}
module.exports = { create };
