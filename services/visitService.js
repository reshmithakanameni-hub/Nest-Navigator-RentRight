'use strict';
const crypto = require('node:crypto');
const repository = require('../repositories/visitRepository');
const { validEmail, validName, validVisitDate, validVisitTime, safeId } = require('../lib/validation');
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function schedule(body) {
  const visit = { name: String(body.name || '').trim(), email: String(body.email || '').trim().toLowerCase(), propertyId: safeId(body.propertyId), date: String(body.date || ''), time: String(body.time || '') };
  if (!validName(visit.name) || !validEmail(visit.email) || !visit.propertyId || !validVisitDate(visit.date) || !validVisitTime(visit.time))
    fail(400, 'Check your name, email, property, future date and available time slot.');
  if (!repository.propertyExists(visit.propertyId)) fail(404, 'Property not found.');
  visit.id = crypto.randomUUID();
  try { repository.create(visit); }
  catch (error) {
    // The partial unique index is the source of truth, so concurrent requests cannot both succeed.
    if (/UNIQUE constraint failed/i.test(error.message)) fail(409, 'That time slot is already requested for this property. Please choose another.');
    throw error;
  }
  return { id: visit.id, status: 'REQUESTED', message: 'Visit request submitted successfully.' };
}
module.exports = { schedule };
