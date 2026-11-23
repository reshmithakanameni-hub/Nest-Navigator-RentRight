'use strict';
const controller = require('../controllers/authController');
function handle(req, res, pathname, readBody) {
  if (req.method === 'POST' && pathname === '/api/auth/register') { return controller.register(req, res, readBody).then(() => true); }
  if (req.method === 'POST' && pathname === '/api/auth/login') { return controller.login(req, res, readBody).then(() => true); }
  if (req.method === 'POST' && pathname === '/api/auth/change-password') { return controller.changePassword(req, res, readBody).then(() => true); }
  if (req.method === 'POST' && pathname === '/api/auth/forgot-password') { return controller.forgotPassword(req, res, readBody).then(() => true); }
  if (req.method === 'POST' && pathname === '/api/auth/reset-password') { return controller.resetPassword(req, res, readBody).then(() => true); }
  if (req.method === 'GET' && pathname === '/api/auth/me') { controller.me(req, res); return true; }
  if (req.method === 'POST' && pathname === '/api/auth/logout') { controller.logout(req, res); return true; }
  return false;
}
module.exports = { handle };
