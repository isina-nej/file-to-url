/**
 * @file Integration Tests: Concurrency, Idempotency, and Security Protection
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import handleMessage from '../../tgcloud/handlers/message.js';
import { db, resetDatabase, apiCalls } from '../mocks/sdk.js';
import { files, processedEvents } from '../../tgcloud/schema.js';
import { toggleFileStatus } from '../../tgcloud/lib/files.js';
import { checkRateLimit } from '../../tgcloud/lib/rate-limit.js';

test.beforeEach(() => {
  resetDatabase();
  apiCalls.clear();
});

test('Idempotency: Repeated Telegram updates with same message_id are ignored', async () => {
  const message = {
    message_id: 301,
    from: { id: 123, first_name: 'Tester' },
    chat: { id: 123 },
    text: '/help',
  };

  // First execution
  await handleMessage(message);
  assert.equal(apiCalls.sentMessages.length, 1);

  // Duplicate update re-delivery
  await handleMessage(message);
  // Should NOT send a second message
  assert.equal(apiCalls.sentMessages.length, 1);
});

test('Rate Limiter: Blocks excessive attempts beyond threshold', async () => {
  const actionKey = 'test_user_burst';

  // Perform 5 allowed requests (max 5)
  for (let i = 0; i < 5; i++) {
    const res = await checkRateLimit(actionKey, 5, 60);
    assert.equal(res.allowed, true);
  }

  // 6th attempt in same window should be blocked
  const blockedRes = await checkRateLimit(actionKey, 5, 60);
  assert.equal(blockedRes.allowed, false);
  assert.ok(blockedRes.retryAfter > 0);
});

test('Security: Non-owner cannot toggle or modify another user file', async () => {
  const insertRes = await db.insert(files).values({
    share_token: 'f_privateUserA',
    owner_user_id: 100, // Owned by user 100
    admin_user_id: 100,
    status: 'ACTIVE',
    source_chat_id: 100,
    source_message_id: 1,
    storage_chat_id: -1001234567890,
    storage_message_id: 10,
    media_type: 'document',
    file_name: 'private.pdf',
    received_at: 1000,
    created_at: 1000,
    published_at: 1000,
    updated_at: 1000,
    expires_at: null,
  });

  const fileId = insertRes.lastInsertRowid;

  // Attacker (user 200) attempts to toggle file status
  await assert.rejects(
    () => toggleFileStatus(fileId, 200),
    (err) => err.code === 'UNAUTHORIZED'
  );

  // Verify file status was NOT changed
  const file = await db.select().from(files);
  assert.equal(file[0].status, 'ACTIVE');
});
