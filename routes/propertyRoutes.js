'use strict';
const controller = require('../controllers/propertyController');

function handle(req, res, pathname, searchParams) {
  if (req.method === 'GET' && pathname === '/api/properties') {
    controller.list(req, res, searchParams); return true;
  }
  if (req.method === 'GET' && pathname === '/api/recommendations') {
    controller.recommendations(res, searchParams); return true;
  }
  return false;
}

module.exports = { handle };
