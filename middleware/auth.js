'use strict';
const crypto = require('node:crypto');
const { send } = require('../lib/http');
const sessions = require('../repositories/sessionRepository');
function getCookie(req, name) {
  const entry = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : '';
}
function digestToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function userFor(req) {
  const token = getCookie(req, 'nn_session');
  return token ? sessions.findValid(digestToken(token)) : null;
}
function requireUser(req, res, role) {
  const user = userFor(req);
  if (!user) { send(res, 401, { error: 'Authentication required.' }); return null; }
  if (role && user.role !== role) { send(res, 403, { error: `${role[0].toUpperCase()}${role.slice(1)} access required.` }); return null; }
  return user;
}
function safeUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
module.exports = { getCookie, digestToken, userFor, requireUser, safeUser };
