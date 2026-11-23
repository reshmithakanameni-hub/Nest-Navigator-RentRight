'use strict';
// STARTTLS and implicit-TLS paths of the SMTP client, against a fake TLS-capable server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');
const { execFileSync } = require('node:child_process');
const { sendMail } = require('../lib/smtp');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nestnavigator-smtp-tls-'));
let credentials = null;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
    '-keyout', path.join(temp, 'key.pem'), '-out', path.join(temp, 'cert.pem')], { stdio: 'ignore' });
  credentials = { key: fs.readFileSync(path.join(temp, 'key.pem')), cert: fs.readFileSync(path.join(temp, 'cert.pem')) };
} catch { /* openssl missing: tests are skipped */ }

function session(socket, { offerStartTls, onData }) {
  let data = false, buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', chunk => {
    buffer += chunk;
    for (;;) {
      if (data) { const end = buffer.indexOf('\r\n.\r\n'); if (end === -1) return; onData(buffer.slice(0, end)); buffer = buffer.slice(end + 5); data = false; socket.write('250 queued\r\n'); continue; }
      const eol = buffer.indexOf('\r\n'); if (eol === -1) return;
      const line = buffer.slice(0, eol); buffer = buffer.slice(eol + 2);
      if (/^EHLO/.test(line)) socket.write(offerStartTls ? '250-fake\r\n250 STARTTLS\r\n' : '250 fake\r\n');
      else if (line === 'STARTTLS') {
        socket.write('220 ready\r\n'); socket.removeAllListeners('data');
        const secure = new tls.TLSSocket(socket, { isServer: true, ...credentials });
        session(secure, { offerStartTls: false, onData }); return;
      } else if (/^(MAIL FROM|RCPT TO)/.test(line)) socket.write('250 ok\r\n');
      else if (line === 'DATA') { data = true; socket.write('354 go\r\n'); }
      else if (line === 'QUIT') { socket.write('221 bye\r\n'); socket.end(); }
    }
  });
}

const options = { host: '127.0.0.1', from: 'a@example.test', to: 'b@example.test', subject: 'Hi', text: 'Secret body', rejectUnauthorized: false };

test('STARTTLS upgrades the connection before sending', { skip: !credentials && 'openssl not available' }, async () => {
  let received = '';
  const server = net.createServer(socket => { socket.write('220 fake\r\n'); session(socket, { offerStartTls: true, onData: text => { received = text; } }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await sendMail({ ...options, port: server.address().port });
    assert.match(received, /Secret body/);
  } finally { server.close(); }
});

test('implicit TLS (port 465 style) delivers a message', { skip: !credentials && 'openssl not available' }, async () => {
  let received = '';
  const server = tls.createServer(credentials, socket => { socket.write('220 fake\r\n'); session(socket, { offerStartTls: false, onData: text => { received = text; } }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await sendMail({ ...options, port: server.address().port, secure: true });
    assert.match(received, /Secret body/);
  } finally { server.close(); fs.rmSync(temp, { recursive: true, force: true }); }
});
