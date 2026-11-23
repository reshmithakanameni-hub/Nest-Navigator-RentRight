'use strict';
const { readJson } = require('../lib/request');
const property = require('./propertyRoutes');
const tools = require('./toolsRoutes');
const auth = require('./authRoutes');
const visits = require('./visitRoutes');
const owner = require('./ownerRoutes');
const shortlist = require('./shortlistRoutes');
const healthController = require('../controllers/healthController');
async function handle(req, res, pathname, searchParams) {
  if (tools.handle(req, res, pathname, searchParams)) return true;
  if (property.handle(req, res, pathname, searchParams)) return true;
  if (await auth.handle(req, res, pathname, readJson)) return true;
  if (await visits.handle(req, res, pathname, readJson)) return true;
  if (await owner.handle(req, res, pathname, readJson)) return true;
  if (await shortlist.handle(req, res, pathname, readJson)) return true;
  if (req.method === 'GET' && pathname === '/api/health') { healthController.health(res); return true; }
  return false;
}
module.exports = { handle };
