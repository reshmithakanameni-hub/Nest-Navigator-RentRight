'use strict';
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db } = require('./lib/database');
const { send } = require('./lib/http');
const apiRoutes = require('./routes/apiRoutes');
const { allowed: originAllowed } = require('./middleware/originProtection');
const rateLimits = require('./repositories/rateLimitRepository');
const sessions = require('./repositories/sessionRepository');
const { createBackup } = require('./lib/backup');
const { tlsOptions, httpsRedirect } = require('./lib/security');
const resets = require('./repositories/passwordResetRepository');
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const GENERAL_RATE_LIMIT = Math.max(20, Number(process.env.RATE_LIMIT_PER_MINUTE) || 120);
const LOGIN_RATE_LIMIT = Math.max(5, Number(process.env.LOGIN_RATE_LIMIT_PER_MINUTE) || 12);

async function route(req, res) {
  const redirect = httpsRedirect(req);
  if (redirect) { res.writeHead(308, { Location: redirect }); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  if (pathname.startsWith('/api/')) {
    const strict = ['/api/auth/login', '/api/auth/change-password', '/api/auth/forgot-password', '/api/auth/reset-password'].includes(pathname);
    const key = strict ? pathname : '/api';
    const limit = strict ? LOGIN_RATE_LIMIT : GENERAL_RATE_LIMIT;
    const count = rateLimits.record(req.socket.remoteAddress || 'unknown', key);
    if (count > limit) return send(res, 429, { error: 'Too many requests. Try again shortly.' }, { 'Retry-After': '60' });
    if (!originAllowed(req)) return send(res, 403, { error: 'Request origin is not allowed.' });
    if (await apiRoutes.handle(req, res, pathname, url.searchParams)) return;
    return send(res, 404, { error: 'API endpoint not found.' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
  let decoded;
  try { decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname); }
  catch { return send(res, 400, { error: 'Invalid path.' }); }
  const target = path.resolve(ROOT, `.${decoded}`);
  if (!target.startsWith(ROOT + path.sep)) return send(res, 403, { error: 'Forbidden.' });
  const relative = path.relative(ROOT, target);
  const isPublic = ['index.html', 'app.js', 'style.css'].includes(relative) || relative.startsWith(`public${path.sep}`);
  if (!isPublic) return send(res, 404, { error: 'Not found.' });
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      ...(process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true' ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
      'Content-Security-Policy': "default-src 'self' https: data:; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com"
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

const tls = tlsOptions();
// Every response carries X-Request-Id; one JSON access-log line per request (path only, never the
// query string or body, so tokens and personal data are not logged). Silence with LOG_REQUESTS=false.
const handler = (req, res) => {
  const requestId = crypto.randomUUID(), startedAt = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);
  if (process.env.NODE_ENV !== 'test' && process.env.LOG_REQUESTS !== 'false') {
    res.on('finish', () => console.log(JSON.stringify({ time: new Date().toISOString(), id: requestId, method: req.method,
      path: (req.url || '').split('?')[0], status: res.statusCode, ms: Number((process.hrtime.bigint() - startedAt) / 1000n) / 1000 })));
  }
  Promise.resolve(route(req, res)).catch(error => {
    console.error('Request failure:', error);
    if (!res.headersSent) send(res, 500, { error: 'Unexpected server error.' });
    else res.destroy();
  });
};
const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
const sessionSweep = setInterval(() => { sessions.removeExpired(); resets.removeExpired(); }, 60_000);
sessionSweep.unref();
const rateSweep = setInterval(() => rateLimits.cleanup(Date.now() - 120_000), 60_000);
rateSweep.unref();
const backupInterval = Math.max(60_000, Number(process.env.BACKUP_INTERVAL_MS) || 86_400_000);
const backupSweep = setInterval(() => {
  try { createBackup(db, { root: ROOT, directory: process.env.BACKUP_DIR, keep: Number(process.env.BACKUP_KEEP) || 7 }); }
  catch (error) { console.error('Scheduled database backup failed:', error.message); }
}, backupInterval);
backupSweep.unref();
if (require.main === module) server.listen(PORT, () => console.log(`NestNavigator running at ${tls ? 'https' : 'http'}://localhost:${PORT}`));
module.exports = { server, db, route };
