/**
 * @file Unit Tests: Expiration and Persian/Arabic Numerals Normalization
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDigits,
  parseExpirationDays,
  calculateExpiresAt,
  isFileExpired,
} from '../../tgcloud/lib/expiration.js';

test('normalizeDigits: converts Persian and Arabic digits to ASCII digits', () => {
  assert.equal(normalizeDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
  assert.equal(normalizeDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  assert.equal(normalizeDigits(' ۳۰ روز '), '30 روز');
  assert.equal(normalizeDigits('۳۶۵'), '365');
});

test('parseExpirationDays: accepts valid integer ranges (1 to 3650 days)', () => {
  const cases = [
    { input: '1', expected: 1 },
    { input: '7', expected: 7 },
    { input: '30', expected: 30 },
    { input: '365', expected: 365 },
    { input: '3650', expected: 3650 },
    { input: '۱', expected: 1 },
    { input: '۳۰', expected: 30 },
    { input: '٣٦٥', expected: 365 },
  ];

  for (const c of cases) {
    const res = parseExpirationDays(c.input);
    assert.equal(res.valid, true, `Expected valid for ${c.input}`);
    assert.equal(res.days, c.expected);
  }
});

test('parseExpirationDays: strictly rejects invalid values', () => {
  const invalidInputs = [
    '0', '۰', '-1', '-30', '1.5', '۲.۵', 'abc', 'یک روز', '', null, undefined, '3651', '1000000',
  ];

  for (const inp of invalidInputs) {
    const res = parseExpirationDays(inp);
    assert.equal(res.valid, false, `Expected invalid for: ${inp}`);
    assert.ok(res.error.length > 0);
  }
});

test('calculateExpiresAt: accurately calculates epoch timestamp in seconds', () => {
  const publishedAt = 1700000000;
  assert.equal(calculateExpiresAt(publishedAt, 1), 1700000000 + 86400);
  assert.equal(calculateExpiresAt(publishedAt, 30), 1700000000 + (30 * 86400));
  assert.equal(calculateExpiresAt(publishedAt, null), null);
  assert.equal(calculateExpiresAt(publishedAt, undefined), null);
});

test('isFileExpired: correctly performs lazy evaluation', () => {
  const now = 1700000000;

  // Unlimited file
  assert.equal(isFileExpired({ expires_at: null }, now), false);

  // Still active
  assert.equal(isFileExpired({ expires_at: now + 500 }, now), false);

  // Exactly at expiration time
  assert.equal(isFileExpired({ expires_at: now }, now), true);

  // Past expiration
  assert.equal(isFileExpired({ expires_at: now - 100 }, now), true);
});
