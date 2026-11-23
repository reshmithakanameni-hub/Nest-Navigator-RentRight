'use strict';
// Outgoing mail boundary. With SMTP_HOST set, messages are delivered over SMTP (lib/smtp.js).
// Otherwise the console transport prints them, which is enough to demonstrate the reset flow.
const { sendMail } = require('./smtp');
const outbox = [];

function smtpSettings(env = process.env) {
  if (!env.SMTP_HOST) return null;
  return { host: env.SMTP_HOST, port: Number(env.SMTP_PORT) || (env.SMTP_SECURE === 'true' ? 465 : 587),
    secure: env.SMTP_SECURE === 'true', user: env.SMTP_USER, pass: env.SMTP_PASS,
    from: env.SMTP_FROM || env.SMTP_USER || 'no-reply@nestnavigator.local' };
}

// Returns a promise that never rejects: delivery problems are logged, so callers (and response
// timing) behave identically whether or not the account exists.
async function send(message) {
  outbox.push({ ...message, sentAt: new Date().toISOString() });
  if (outbox.length > 20) outbox.shift();
  const settings = smtpSettings();
  if (settings) {
    try { await sendMail({ ...settings, ...message }); }
    catch (error) { console.error('[mail:smtp] delivery failed:', error.message); }
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    console.log(`\n[mail:console] To: ${message.to}\n[mail:console] Subject: ${message.subject}\n[mail:console] ${message.text}\n`);
  }
}

module.exports = { send, outbox, smtpSettings };
