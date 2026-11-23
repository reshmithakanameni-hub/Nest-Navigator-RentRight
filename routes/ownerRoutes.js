'use strict';
const controller = require('../controllers/ownerController');
function handle(req, res, pathname, readBody) {
  if (req.method === 'POST' && pathname === '/api/owner/properties/claim') return controller.claim(req, res, readBody).then(() => true);
  if (req.method === 'GET' && pathname === '/api/owner/visits') { controller.visits(req, res); return true; }
  const match = pathname.match(/^\/api\/owner\/visits\/([a-f0-9-]+)$/i);
  if (req.method === 'PATCH' && match) return controller.updateVisit(req, res, match[1], readBody).then(() => true);
  return false;
}
module.exports = { handle };
