'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const users = require('../repositories/userRepository');
const sessions = require('../repositories/sessionRepository');
const audit = require('../repositories/auditRepository');
const resets = require('../repositories/passwordResetRepository');
const mailer = require('../lib/mailer');
const { digestToken, safeUser } = require('../middleware/auth');
const { validEmail, validName, validPassword, validResetToken } = require('../lib/validation');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent. It expires in 30 minutes.';
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
async function register(body) {
  const name = String(body.name || '').trim(), email = String(body.email || '').trim().toLowerCase();
  if (!validName(name) || !validEmail(email) || !validPassword(body.password) || !['tenant', 'owner'].includes(body.role))
    fail(400, 'Enter a valid name, email, role and password (10+ characters including letters and numbers).');
  if (users.findByEmail(email)) fail(409, 'An account with this email already exists.');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = (await scrypt(body.password, salt, 64)).toString('hex');
  const user = { id: crypto.randomUUID(), name, email, role: body.role, salt, passwordHash };
  users.create(user);
  audit.record('REGISTER', user.id, user.role);
  return { user: safeUser(user) };
}
async function login(body) {
  const email = String(body.email || '').trim().toLowerCase(), password = String(body.password || '');
  const user = users.findByEmail(email);
  if (!user || password.length > 128) { audit.record('LOGIN_FAILED', null, 'unknown account'); fail(401, 'Invalid email or password.'); }
  const candidate = await scrypt(password, user.salt, 64), expected = Buffer.from(user.password_hash, 'hex');
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) {
    audit.record('LOGIN_FAILED', user.id, 'bad password');
    fail(401, 'Invalid email or password.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.create(digestToken(token), user.id, Date.now() + SESSION_TTL_MS);
  audit.record('LOGIN', user.id);
  return { user: safeUser(user), token, maxAge: SESSION_TTL_MS / 1000 };
}
// Verifies the current password, stores a new salted hash, signs out every existing session
// (so a stolen cookie stops working) and issues a fresh session for the caller.
async function changePassword(userId, body) {
  const current = String(body.currentPassword || ''), next = String(body.newPassword || '');
  const user = users.findById(userId);
  if (!user || current.length > 128) fail(401, 'Current password is incorrect.');
  const candidate = await scrypt(current, user.salt, 64), expected = Buffer.from(user.password_hash, 'hex');
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) {
    audit.record('PASSWORD_CHANGE_FAILED', user.id, 'bad current password');
    fail(401, 'Current password is incorrect.');
  }
  if (!validPassword(next)) fail(400, 'New password must be 10+ characters including letters and numbers.');
  if (next === current) fail(400, 'New password must be different from the current password.');
  const salt = crypto.randomBytes(16).toString('hex');
  users.updatePassword(user.id, salt, (await scrypt(next, salt, 64)).toString('hex'));
  sessions.removeAllForUser(user.id);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.create(digestToken(token), user.id, Date.now() + SESSION_TTL_MS);
  audit.record('PASSWORD_CHANGED', user.id);
  return { token, maxAge: SESSION_TTL_MS / 1000 };
}
// Password recovery. The response is identical whether or not the email exists, so the form cannot be
// used to discover accounts. Only a SHA-256 digest of the token is stored; the token itself is
// delivered through the mailer (and returned to the caller only outside production, for demos).
function requestPasswordReset(body, baseUrl = '') {
  const email = String(body.email || '').trim().toLowerCase();
  const result = { message: RESET_MESSAGE };
  if (!validEmail(email)) return result;
  const user = users.findByEmail(email);
  if (!user) { audit.record('PASSWORD_RESET_REQUESTED', null, 'unknown account'); return result; }
  resets.removeForUser(user.id);
  const token = crypto.randomBytes(32).toString('hex');
  resets.create(digestToken(token), user.id, Date.now() + RESET_TTL_MS);
  const link = `${baseUrl}/#reset=${token}`;
  void mailer.send({ to: user.email, subject: 'Reset your NestNavigator password',
    text: `Open this link within 30 minutes to choose a new password: ${link}\nIf you did not ask for this, ignore this message.` });
  audit.record('PASSWORD_RESET_REQUESTED', user.id);
  if (process.env.NODE_ENV !== 'production') result.devResetLink = link;
  return result;
}

// Consumes a single-use token, stores a new salted hash and signs the account out everywhere.
async function resetPassword(body) {
  const token = body.token, next = String(body.newPassword || '');
  if (!validResetToken(token)) fail(400, 'This reset link is invalid or has expired.');
  if (!validPassword(next)) fail(400, 'New password must be 10+ characters including letters and numbers.');
  const userId = resets.consume(digestToken(token));
  if (!userId) { audit.record('PASSWORD_RESET_FAILED', null, 'invalid or expired token'); fail(400, 'This reset link is invalid or has expired.'); }
  const salt = crypto.randomBytes(16).toString('hex');
  users.updatePassword(userId, salt, (await scrypt(next, salt, 64)).toString('hex'));
  sessions.removeAllForUser(userId);
  resets.removeForUser(userId);
  audit.record('PASSWORD_RESET_COMPLETED', userId);
  return { message: 'Password updated. Sign in with your new password.' };
}
function logout(token) { if (token) sessions.remove(digestToken(token)); }
module.exports = { register, login, changePassword, requestPasswordReset, resetPassword, logout };
