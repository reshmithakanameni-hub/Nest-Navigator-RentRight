'use strict';
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let length = 0, tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      length += chunk.length;
      if (length > 12000) { tooLarge = true; chunks.length = 0; return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
module.exports = { readJson };
