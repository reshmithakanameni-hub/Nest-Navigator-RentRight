'use strict';
const auth = require('../services/authService');
const { send } = require('../lib/http');
const { getCookie, userFor, requireUser } = require('../middleware/auth');
const { isSecureRequest, secureCookieFlag } = require('../lib/security');
async function register(req, res, readBody) {
  try { const result = await auth.register(await readBody(req)); send(res, 201, { message: 'Account created. Please sign in.', user: result.user }); }
  catch (error) { send(res, error.status || 400, { error: error.message || 'Registration failed.' }); }
}
async function login(req, res, readBody) {
  try {
    const result = await auth.login(await readBody(req));
    const secure = secureCookieFlag(req);
    send(res, 200, { user: result.user }, { 'Set-Cookie': `nn_session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${result.maxAge}${secure}` });
  } catch (error) { send(res, error.status || 400, { error: error.message || 'Login failed.' }); }
}
async function changePassword(req, res, readBody) {
  const user = requireUser(req, res); if (!user) return;
  try {
    const result = await auth.changePassword(user.id, await readBody(req));
    const secure = secureCookieFlag(req);
    send(res, 200, { message: 'Password changed. Other devices were signed out.' }, { 'Set-Cookie': `nn_session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${result.maxAge}${secure}` });
  } catch (error) { send(res, error.status || 400, { error: error.message || 'Password change failed.' }); }
}
function baseUrl(req) {
  const proto = isSecureRequest(req) ? 'https' : 'http';
  return /^[a-z0-9.-]+(:\d+)?$/i.test(req.headers.host || '') ? `${proto}://${req.headers.host}` : '';
}
async function forgotPassword(req, res, readBody) {
  try { send(res, 200, auth.requestPasswordReset(await readBody(req), baseUrl(req))); }
  catch (error) { send(res, error.status || 400, { error: error.message || 'Request failed.' }); }
}
async function resetPassword(req, res, readBody) {
  try { send(res, 200, await auth.resetPassword(await readBody(req))); }
  catch (error) { send(res, error.status || 400, { error: error.message || 'Password reset failed.' }); }
}
function me(req, res) { const user = userFor(req); send(res, user ? 200 : 401, user ? { user } : { error: 'Authentication required.' }); }
function logout(req, res) {
  auth.logout(getCookie(req, 'nn_session'));
  const secure = secureCookieFlag(req);
  send(res, 200, { message: 'Signed out.' }, { 'Set-Cookie': `nn_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}` });
}
module.exports = { register, login, changePassword, forgotPassword, resetPassword, me, logout };
