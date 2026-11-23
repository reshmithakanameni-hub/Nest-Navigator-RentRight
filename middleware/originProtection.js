'use strict';
const { getCookie } = require('./auth');
function allowed(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const origin = req.headers.origin;
  if (origin) {
    try { const source = new URL(origin); return source.host === req.headers.host && ['http:', 'https:'].includes(source.protocol); }
    catch { return false; }
  }
  // Cookie-authenticated writes must carry an Origin header.
  return !getCookie(req, 'nn_session');
}
module.exports = { allowed };
