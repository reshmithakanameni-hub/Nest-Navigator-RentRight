'use strict';
// SMTP client tested against an in-process fake server that speaks enough of the protocol.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { sendMail } = require('../lib/smtp');
const { smtpSettings } = require('../lib/mailer');

function fakeServer({ failRcpt = false } = {}) {
  const log = [];
  const server = net.createServer(socket => {
    socket.setEncoding('utf8'); let data = false, buffer = '';
    socket.write('220 fake ESMTP\r\n');
    socket.on('data', chunk => {
      buffer += chunk;
      while (true) {
        if (data) { const end = buffer.indexOf('\r\n.\r\n'); if (end === -1) return; log.push({ data: buffer.slice(0, end) }); buffer = buffer.slice(end + 5); data = false; socket.write('250 queued\r\n'); continue; }
        const eol = buffer.indexOf('\r\n'); if (eol === -1) return;
        const line = buffer.slice(0, eol); buffer = buffer.slice(eol + 2); log.push({ line });
        if (/^EHLO/.test(line)) socket.write('250-fake\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n');
        else if (/^AUTH PLAIN/.test(line)) socket.write('235 ok\r\n');
        else if (/^MAIL FROM/.test(line)) socket.write('250 ok\r\n');
        else if (/^RCPT TO/.test(line)) socket.write(failRcpt ? '550 no such user\r\n' : '250 ok\r\n');
        else if (line === 'DATA') { data = true; socket.write('354 go\r\n'); }
        else if (line === 'QUIT') { socket.write('221 bye\r\n'); socket.end(); }
      }
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, log, port: server.address().port })));
}

test('delivers a message with authentication and dot-stuffing', async () => {
  const { server, log, port } = await fakeServer();
  try {
    await sendMail({ host: '127.0.0.1', port, user: 'mailer', pass: 'secret', from: 'NestNavigator <no-reply@example.test>', to: 'tenant@example.test',
      subject: 'Reset', text: 'Line one\n.starts with a dot\nhttp://x/#reset=abc' });
    const lines = log.filter(entry => entry.line).map(entry => entry.line);
    assert.ok(lines.some(line => line === `AUTH PLAIN ${Buffer.from('\0mailer\0secret').toString('base64')}`));
    assert.ok(lines.includes('MAIL FROM:<no-reply@example.test>') && lines.includes('RCPT TO:<tenant@example.test>'));
    const body = log.find(entry => entry.data).data;
    assert.match(body, /Subject: Reset/); assert.match(body, /\r\n\.\.starts with a dot/); assert.match(body, /#reset=abc/);
  } finally { server.close(); }
});

test('a rejected recipient is reported and header injection is refused', async () => {
  const { server, port } = await fakeServer({ failRcpt: true });
  try {
    await assert.rejects(sendMail({ host: '127.0.0.1', port, from: 'a@example.test', to: 'x@example.test', subject: 'S', text: 'T' }), /SMTP error 550/);
    await assert.rejects(sendMail({ host: '127.0.0.1', port, from: 'a@example.test', to: 'x@example.test', subject: 'S\r\nBcc: evil@example.test', text: 'T' }), /Invalid email header/);
  } finally { server.close(); }
});

test('SMTP settings come from the environment', () => {
  assert.equal(smtpSettings({}), null);
  assert.deepEqual(smtpSettings({ SMTP_HOST: 'smtp.example.test', SMTP_SECURE: 'true', SMTP_USER: 'u', SMTP_PASS: 'p' }),
    { host: 'smtp.example.test', port: 465, secure: true, user: 'u', pass: 'p', from: 'u' });
});
