'use strict';
const crypto = require('node:crypto');
const { db } = require('../lib/database');
function record(ip, route, now = Date.now()) {
  const digest = crypto.createHash('sha256').update(`${ip}|${route}`).digest('hex');
  const windowStart = Math.floor(now / 60_000) * 60_000;
  const row = db.prepare(`INSERT INTO rate_limits(bucket_hash,window_start,request_count) VALUES(?,?,1)
    ON CONFLICT(bucket_hash) DO UPDATE SET
      request_count=CASE WHEN rate_limits.window_start=excluded.window_start THEN rate_limits.request_count+1 ELSE 1 END,
      window_start=excluded.window_start
    RETURNING request_count`).get(digest, windowStart);
  return row.request_count;
}
function cleanup(before) { db.prepare('DELETE FROM rate_limits WHERE window_start < ?').run(before); }
module.exports = { record, cleanup };
