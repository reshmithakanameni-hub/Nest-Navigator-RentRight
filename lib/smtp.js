'use strict';
// Minimal SMTP client (RFC 5321) built on node:net / node:tls, so real email works without npm packages.
// Supports implicit TLS (port 465, SMTP_SECURE=true), STARTTLS (587) and AUTH LOGIN/PLAIN.
const net = require('node:net');
const tls = require('node:tls');
const os = require('node:os');

const NO_BREAKS = /[\r\n]/;

class Connection {
  constructor(socket, timeoutMs) {
    this.timeoutMs = timeoutMs; this.buffer = ''; this.waiters = []; this.failure = null;
    this.attach(socket);
  }
  attach(socket) {
    this.socket = socket; this.buffer = '';
    socket.setEncoding('utf8'); socket.setTimeout(this.timeoutMs);
    socket.on('data', chunk => { this.buffer += chunk; this.flush(); });
    socket.on('timeout', () => this.fail(new Error('SMTP connection timed out.')));
    socket.on('error', error => this.fail(error));
    socket.on('close', () => this.fail(new Error('SMTP connection closed unexpectedly.')));
  }
  fail(error) { this.failure ||= error; this.flush(); }
  // A reply is complete when its last line has "NNN " (space) after the code.
  flush() {
    while (this.waiters.length) {
      const lines = this.buffer.split('\r\n');
      const last = lines.findIndex(line => /^\d{3} /.test(line));
      if (last === -1) { if (this.failure) this.waiters.shift().reject(this.failure); return; }
      const reply = lines.slice(0, last + 1);
      this.buffer = lines.slice(last + 1).join('\r\n');
      this.waiters.shift().resolve({ code: Number(reply[last].slice(0, 3)), lines: reply });
    }
  }
  read() { return new Promise((resolve, reject) => { this.waiters.push({ resolve, reject }); this.flush(); }); }
  async command(text, ...expected) {
    this.socket.write(`${text}\r\n`);
    return this.expect(expected);
  }
  async expect(codes) {
    const reply = await this.read();
    if (!codes.includes(reply.code)) throw new Error(`SMTP error ${reply.code}: ${reply.lines.at(-1)}`);
    return reply;
  }
}

async function sendMail({ host, port = 587, secure = false, user, pass, from, to, subject, text, timeoutMs = 10_000, rejectUnauthorized = true }) {
  for (const value of [from, to, subject]) if (!value || NO_BREAKS.test(value)) throw new Error('Invalid email header value.');
  const connect = () => new Promise((resolve, reject) => {
    const socket = secure ? tls.connect({ host, port, servername: host, rejectUnauthorized }) : net.connect({ host, port });
    socket.once(secure ? 'secureConnect' : 'connect', () => resolve(socket)); socket.once('error', reject);
  });
  const connection = new Connection(await connect(), timeoutMs);
  try {
    await connection.expect([220]);
    const name = os.hostname().replace(/[^a-z0-9.-]/gi, '') || 'localhost';
    let hello = await connection.command(`EHLO ${name}`, 250);
    if (!secure && hello.lines.some(line => /STARTTLS/i.test(line))) {
      await connection.command('STARTTLS', 220);
      const upgraded = tls.connect({ socket: connection.socket, servername: host, rejectUnauthorized });
      await new Promise((resolve, reject) => { upgraded.once('secureConnect', resolve); upgraded.once('error', reject); });
      connection.socket.removeAllListeners('data'); connection.attach(upgraded);
      hello = await connection.command(`EHLO ${name}`, 250);
    }
    if (user) {
      const token = Buffer.from(`\0${user}\0${pass || ''}`).toString('base64');
      await connection.command(`AUTH PLAIN ${token}`, 235);
    }
    await connection.command(`MAIL FROM:<${from.replace(/^.*<|>.*$/g, '')}>`, 250);
    await connection.command(`RCPT TO:<${to}>`, 250, 251);
    await connection.command('DATA', 354);
    const body = String(text).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    const message = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', body, '.'].join('\r\n');
    await connection.command(message, 250);
    await connection.command('QUIT', 221).catch(() => {});
  } finally { connection.socket.destroy(); }
}

module.exports = { sendMail };
