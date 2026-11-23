'use strict';
// Runs in a separate OS process against the shared SQLite file to exercise real write contention.
const crypto = require('node:crypto');
const { db } = require('../../lib/database');
const owners = require('../../repositories/ownerRepository');
const visitService = require('../../services/visitService');
const shortlist = require('../../repositories/shortlistRepository');

const worker = Number(process.argv[2]);
const result = { claimWins: 0, slotWins: 0, slotConflicts: 0, shortlistRows: 0, errors: [] };
const note = error => result.errors.push(error.message);

try {
  // Every worker races to claim the same listing; exactly one may win.
  if (owners.claim(`owner-${worker}`, 5) === 1) result.claimWins++;
} catch (error) { note(error); }

for (let round = 0; round < 20; round++) {
  try {
    // Every worker races for the same visit slot; the unique index lets exactly one through per round.
    visitService.schedule({ name: 'Racer Test', email: `racer${worker}@example.test`, propertyId: 6, date: `2099-06-${String(round + 1).padStart(2, '0')}`, time: '10:00 AM' });
    result.slotWins++;
  } catch (error) {
    if (error.status === 409) result.slotConflicts++; else note(error);
  }
  try {
    // Distinct rows per worker must all succeed despite concurrent writers.
    shortlist.add(`user-${worker}`, (round % 12) + 1);
    result.shortlistRows++;
  } catch (error) { note(error); }
}
db.close();
process.stdout.write(JSON.stringify(result));
