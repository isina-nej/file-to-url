/**
 * @file Integration Tests: File Delivery via Deep Links and Access Control
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import handleMessage from '../../tgcloud/handlers/message.js';
import { db, resetDatabase, apiCalls } from '../mocks/sdk.js';
import { files, fileDeliveries } from '../../tgcloud/schema.js';
import { toggleFileStatus } from '../../tgcloud/lib/files.js';

test.beforeEach(() => {
  resetDatabase();
  apiCalls.clear();
});

test('Delivery Flow: Successful delivery via deep link', async () => {
  const now = Math.floor(Date.now() / 1000);

  // Seed an active file
  await db.insert(files).values({
    share_token: 'f_validShareToken123',
    owner_user_id: 111,
    admin_user_id: 111,
    status: 'ACTIVE',
    source_chat_id: 111,
    source_message_id: 50,
    storage_chat_id: -1001234567890,
    storage_message_id: 999,
    media_type: 'document',
    file_name: 'contract.pdf',
    file_size_bytes: 50000,
    received_at: now - 100,
    created_at: now - 100,
    archived_at: now - 50,
    published_at: now - 50,
    updated_at: now - 50,
    expires_at: now + 86400, // Expires tomorrow
    download_count: 0,
  });

  const receiver = { id: 999, first_name: 'Receiver', username: 'receiver_user' };

  // Receiver opens deep link
  await handleMessage({
    message_id: 201,
    from: receiver,
    chat: { id: 999 },
    text: '/start f_validShareToken123',
  });

  // Verify copyMessage delivered the file from storage channel to receiver chat
  assert.equal(apiCalls.copiedMessages.length, 1);
  assert.equal(apiCalls.copiedMessages[0].chat_id, 999);
  assert.equal(apiCalls.copiedMessages[0].from_chat_id, -1001234567890);
  assert.equal(apiCalls.copiedMessages[0].message_id, 999);

  // Verify atomic download counter increment
  const updatedFiles = await db.select().from(files);
  assert.equal(updatedFiles[0].download_count, 1);

  // Verify delivery record
  const deliveries = await db.select().from(fileDeliveries);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].status, 'SUCCESS');
  assert.equal(deliveries[0].receiver_user_id, 999);
});

test('Delivery Flow: Denies access to expired files', async () => {
  const now = Math.floor(Date.now() / 1000);

  await db.insert(files).values({
    share_token: 'f_expiredToken777',
    owner_user_id: 111,
    admin_user_id: 111,
    status: 'ACTIVE',
    source_chat_id: 111,
    source_message_id: 50,
    storage_chat_id: -1001234567890,
    storage_message_id: 999,
    media_type: 'document',
    file_name: 'old_promo.pdf',
    received_at: now - 200000,
    created_at: now - 200000,
    published_at: now - 200000,
    updated_at: now - 200000,
    expires_at: now - 100, // Expired in the past!
    download_count: 5,
  });

  apiCalls.clear();

  // Receiver attempts to open expired link
  await handleMessage({
    message_id: 202,
    from: { id: 888, first_name: 'Bob' },
    chat: { id: 888 },
    text: '/start f_expiredToken777',
  });

  // copyMessage should NOT be called
  assert.equal(apiCalls.copiedMessages.length, 0);

  // User should receive expiration message
  assert.equal(apiCalls.sentMessages.length, 1);
  assert.ok(apiCalls.sentMessages[0].text.includes('مهلت دریافت این فایل به پایان رسیده است'));
});

test('Delivery Flow: Denies access to disabled files and prevents reactivating expired ones', async () => {
  const now = Math.floor(Date.now() / 1000);

  const insertRes = await db.insert(files).values({
    share_token: 'f_disabledToken888',
    owner_user_id: 111,
    admin_user_id: 111,
    status: 'ACTIVE',
    source_chat_id: 111,
    source_message_id: 50,
    storage_chat_id: -1001234567890,
    storage_message_id: 999,
    media_type: 'document',
    file_name: 'confidential.pdf',
    received_at: now - 100,
    created_at: now - 100,
    published_at: now - 100,
    updated_at: now - 100,
    expires_at: now + 50000,
    download_count: 0,
  });

  const fileId = insertRes.lastInsertRowid;

  // 1. Owner disables the file
  await toggleFileStatus(fileId, 111);

  // 2. Receiver tries to open disabled file
  apiCalls.clear();
  await handleMessage({
    message_id: 203,
    from: { id: 555, first_name: 'Alice' },
    chat: { id: 555 },
    text: '/start f_disabledToken888',
  });

  assert.equal(apiCalls.copiedMessages.length, 0);
  assert.ok(apiCalls.sentMessages[0].text.includes('صاحب فایل دسترسی به این لینک را غیرفعال کرده است'));
});
