/**
 * @file Integration Tests: Complete File Upload Workflow
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import handleMessage from '../../tgcloud/handlers/message.js';
import handleCallbackQuery from '../../tgcloud/handlers/callback_query.js';
import { db, resetDatabase, apiCalls } from '../mocks/sdk.js';
import { files, uploadSessions } from '../../tgcloud/schema.js';

test.beforeEach(() => {
  resetDatabase();
  apiCalls.clear();
});

test('Upload Flow: Complete sequence from upload to archive and share link generation', async () => {
  const user = { id: 777, first_name: 'Sina', username: 'sina_user' };
  const chatId = 777;

  // 1. User sends a document
  const uploadMessage = {
    message_id: 101,
    from: user,
    chat: { id: chatId },
    date: Math.floor(Date.now() / 1000),
    document: {
      file_id: 'tg_file_abc',
      file_unique_id: 'unique_abc',
      file_name: 'sample_guide.pdf',
      file_size: 204800,
      mime_type: 'application/pdf',
    },
  };

  await handleMessage(uploadMessage);

  // Assert session created in WAITING_CAPTION
  const sessions = await db.select().from(uploadSessions);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].step, 'WAITING_CAPTION');
  assert.equal(sessions[0].user_id, 777);

  // Assert file draft created in WAITING_CAPTION
  const draftFiles = await db.select().from(files);
  assert.equal(draftFiles.length, 1);
  assert.equal(draftFiles[0].status, 'WAITING_CAPTION');
  assert.equal(draftFiles[0].file_name, 'sample_guide.pdf');

  // 2. User clicks "caption_skip" inline button
  const captionCallback = {
    id: 'cb_1',
    from: user,
    message: { message_id: 1001, chat: { id: chatId } },
    data: 'caption_skip',
  };

  await handleCallbackQuery(captionCallback);

  // Assert session transitioned to WAITING_EXPIRY
  const sessionsAfterCaption = await db.select().from(uploadSessions);
  assert.equal(sessionsAfterCaption.length, 1);
  assert.equal(sessionsAfterCaption[0].step, 'WAITING_EXPIRY');

  // 3. User selects 30 days expiration preset ("exp_30")
  const expCallback = {
    id: 'cb_2',
    from: user,
    message: { message_id: 1001, chat: { id: chatId } },
    data: 'exp_30',
  };

  await handleCallbackQuery(expCallback);

  // Assert file archived and session completed
  const sessionsAfterFinish = await db.select().from(uploadSessions);
  assert.equal(sessionsAfterFinish.length, 0, 'Upload session must be deleted after completion');

  const finalFiles = await db.select().from(files);
  assert.equal(finalFiles.length, 1);
  const activeFile = finalFiles[0];
  assert.equal(activeFile.status, 'ACTIVE');
  assert.equal(activeFile.expiration_days, 30);
  assert.ok(activeFile.expires_at > activeFile.published_at);
  assert.ok(activeFile.storage_message_id > 0);
  assert.ok(activeFile.share_token.startsWith('f_'));

  // Assert copyMessage was called to storage channel
  assert.equal(apiCalls.copiedMessages.length, 1);
  assert.equal(apiCalls.copiedMessages[0].from_chat_id, chatId);
  assert.equal(apiCalls.copiedMessages[0].message_id, 101);
});
