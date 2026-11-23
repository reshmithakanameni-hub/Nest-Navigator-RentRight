'use strict';
const ownerRepository = require('../repositories/ownerRepository');
const visitRepository = require('../repositories/visitRepository');
const audit = require('../repositories/auditRepository');
const { safeId } = require('../lib/validation');
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function claim(ownerId, body) {
  const id = safeId(body.propertyId);
  if (!id) fail(400, 'A valid property ID is required.');
  if (!ownerRepository.claim(ownerId, id)) fail(409, 'Property is unavailable or already claimed.');
  audit.record('PROPERTY_CLAIMED', ownerId, `property ${id}`);
  return { message: 'Property linked to your owner account.' };
}
function visits(ownerId) {
  return visitRepository.listForOwner(ownerId).map(row => ({ ...row, email: row.email.replace(/^(.).+(@.+)$/, '$1***$2') }));
}
function updateVisit(ownerId, visitId, status) {
  if (!['CONFIRMED', 'DECLINED', 'COMPLETED'].includes(status)) fail(400, 'Invalid visit status.');
  const visit = visitRepository.findOwned(visitId, ownerId);
  if (!visit) fail(404, 'Visit not found for this owner.');
  visitRepository.updateStatus(visit.id, status);
  audit.record('VISIT_STATUS_CHANGED', ownerId, `${visit.id} -> ${status}`);
  return { message: 'Visit status updated.' };
}
module.exports = { claim, visits, updateVisit };
