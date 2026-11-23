'use strict';
// HTTPS helpers. The app can terminate TLS itself (TLS_KEY_FILE + TLS_CERT_FILE) or sit behind a
// reverse proxy / platform load balancer (TRUST_PROXY=true, which honours X-Forwarded-Proto).
const fs = require('node:fs');

const flag = name => String(process.env[name] || '').toLowerCase() === 'true';

function tlsOptions() {
  const keyFile = process.env.TLS_KEY_FILE, certFile = process.env.TLS_CERT_FILE;
  if (!keyFile && !certFile) return null;
  if (!keyFile || !certFile) throw new Error('Set both TLS_KEY_FILE and TLS_CERT_FILE to enable HTTPS.');
  return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile), minVersion: 'TLSv1.2' };
}

function isSecureRequest(req) {
  if (req.socket && req.socket.encrypted) return true;
  if (flag('TRUST_PROXY')) return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return false;
}

// Cookies are Secure whenever the connection is HTTPS or the deployment is production/forced-HTTPS.
function secureCookieFlag(req) {
  return isSecureRequest(req) || process.env.NODE_ENV === 'production' || flag('FORCE_HTTPS') ? '; Secure' : '';
}

// When FORCE_HTTPS=true, plain-HTTP requests are redirected. /api/health stays reachable for platform probes.
function httpsRedirect(req) {
  if (!flag('FORCE_HTTPS') || isSecureRequest(req)) return null;
  const pathname = (req.url || '/').split('?')[0];
  if (pathname === '/api/health') return null;
  const host = req.headers.host;
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  return `https://${host.replace(/:\d+$/, process.env.HTTPS_PORT ? `:${process.env.HTTPS_PORT}` : '')}${req.url}`;
}

module.exports = { tlsOptions, isSecureRequest, secureCookieFlag, httpsRedirect };
