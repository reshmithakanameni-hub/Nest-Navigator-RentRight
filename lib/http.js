'use strict';
function send(res, status, data, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY', 'X-DNS-Prefetch-Control': 'off',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true' ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
    'Content-Security-Policy': "default-src 'self' https: data:; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com",
    ...extra
  });
  res.end(JSON.stringify(data));
}
module.exports = { send };
