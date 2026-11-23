'use strict';
const controller = require('../controllers/visitController');
function handle(req, res, pathname, readBody) {
  if (req.method === 'POST' && pathname === '/api/visits') return controller.create(req, res, readBody).then(() => true);
  return false;
}
module.exports = { handle };
