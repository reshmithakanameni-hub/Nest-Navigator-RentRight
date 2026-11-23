'use strict';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
export const money = amount => `\u20b9${Number(amount || 0).toLocaleString('en-IN')}`;
