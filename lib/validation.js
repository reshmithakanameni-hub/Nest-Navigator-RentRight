'use strict';

const validEmail = value =>
  typeof value === 'string' &&
  value.length <= 120 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const validName = value =>
  typeof value === 'string' &&
  value.trim().length >= 2 &&
  value.trim().length <= 60 &&
  /^[\p{L}\p{M} .'-]+$/u.test(value.trim());

const validVisitDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date >= today;
};

const validVisitTime = value =>
  typeof value === 'string' &&
  ['10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'].includes(value);

const safeId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const validPassword = value =>
  typeof value === 'string' &&
  value.length >= 10 &&
  value.length <= 128 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value);

const validResetToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

module.exports = { validResetToken, validEmail, validName, validVisitDate, validVisitTime, safeId, validPassword };
