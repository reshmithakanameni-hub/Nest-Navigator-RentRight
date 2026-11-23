'use strict';
const controller = require('../controllers/shortlistController');
function handle(req, res, pathname, readBody) {
  if (pathname === '/api/shortlist' && req.method === 'GET') { controller.list(req, res); return true; }
  if (pathname === '/api/shortlist' && req.method === 'POST') return controller.add(req, res, readBody).then(() => true);
  const match = pathname.match(/^\/api\/shortlist\/(\d+)$/);
  if (match && req.method === 'DELETE') { controller.remove(req, res, match[1]); return true; }
  return false;
}
module.exports = { handle };
