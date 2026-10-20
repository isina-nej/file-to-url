/**
 * @file Unit Tests: Secure Token Generation and Deep Link Handling
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSecureToken,
  generateUniqueShareToken,
  buildDeepLink,
  extractShareToken,
} from '../../tgcloud/lib/links.js';
import { resetDatabase } from '../mocks/sdk.js';

test.beforeEach(() => {
  resetDatabase();
});

test('generateSecureToken: generates safe base62 token with >= 128 bit entropy', () => {
  const token = generateSecureToken(24);
  assert.equal(token.length, 24);
  assert.match(token, /^[0-9A-Za-z]+$/);

  // Uniqueness check across 100 iterations
  const set = new Set();
  for (let i = 0; i < 100; i++) {
    const t = generateSecureToken(24);
    assert.equal(set.has(t), false);
    set.add(t);
  }
});

test('generateUniqueShareToken: adds f_ prefix and stays under 64 characters', async () => {
  const token = await generateUniqueShareToken();
  assert.ok(token.startsWith('f_'));
  assert.ok(token.length <= 64);
  assert.ok(token.length >= 20);
});

test('buildDeepLink: builds standard Telegram start link', () => {
  const link1 = buildDeepLink('MyBot', 'f_testToken123');
  assert.equal(link1, 'https://t.me/MyBot?start=f_testToken123');

  const link2 = buildDeepLink('@AnotherBot', 'f_another');
  assert.equal(link2, 'https://t.me/AnotherBot?start=f_another');
});

test('extractShareToken: parses valid start parameters', () => {
  assert.equal(extractShareToken('/start f_abc1234567890'), 'f_abc1234567890');
  assert.equal(extractShareToken('  /start   f_mySpecialToken_12345  '), 'f_mySpecialToken_12345');
  assert.equal(extractShareToken('/start'), null);
  assert.equal(extractShareToken('/help'), null);
  assert.equal(extractShareToken('/start not_valid'), null);
});
