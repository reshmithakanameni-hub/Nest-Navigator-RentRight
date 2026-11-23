'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validEmail, validName, validVisitDate, validVisitTime, safeId, validPassword } = require('../lib/validation');

test('email, name and password validators reject malformed and oversized input', () => {
  assert.equal(validEmail('person@example.test'), true);
  assert.equal(validEmail('no-at-sign'), false);
  assert.equal(validEmail(`a${'x'.repeat(130)}@example.test`), false);
  assert.equal(validName('Asha Rao'), true);
  assert.equal(validName('<script>'), false);
  assert.equal(validPassword('SecureDemo1234'), true);
  assert.equal(validPassword('short1'), false);
  assert.equal(validPassword('x'.repeat(129) + '1'), false);
});

test('visit dates, allowed times and identifiers reject boundary cases', () => {
  assert.equal(validVisitDate('2099-12-31'), true);
  assert.equal(validVisitDate('2099-02-30'), false);
  assert.equal(validVisitDate('2000-01-01'), false);
  assert.equal(validVisitTime('11:00 AM'), true);
  assert.equal(validVisitTime('11:37 AM'), false);
  assert.equal(safeId('12'), 12);
  assert.equal(safeId('1.5'), null);
  assert.equal(safeId('-2'), null);
});
