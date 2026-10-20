/**
 * @file Unit Tests: Advanced Media Types, Pagination, and Concurrency
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIncomingMedia } from '../../tgcloud/lib/file-parser.js';
import { getUserFiles } from '../../tgcloud/lib/files.js';
import { createUploadSession, transitionSessionStep } from '../../tgcloud/lib/sessions.js';
import { db, resetDatabase } from '../mocks/sdk.js';
import { files, uploadSessions } from '../../tgcloud/schema.js';

test.beforeEach(() => {
  resetDatabase();
});

test('parseIncomingMedia: Audio media extraction', () => {
  const msg = {
    message_id: 50,
    audio: {
      file_id: 'aud_1',
      file_unique_id: 'uaud_1',
      title: 'Beethoven 5th',
      performer: 'Symphony Orchestra',
      duration: 420,
      mime_type: 'audio/mpeg',
      file_size: 5242880,
    },
  };

  const parsed = parseIncomingMedia(msg);
  assert.equal(parsed.mediaType, 'audio');
  assert.equal(parsed.durationSeconds, 420);
  assert.equal(parsed.fileName, 'Symphony Orchestra - Beethoven 5th.mp3');
});

test('parseIncomingMedia: Video media extraction', () => {
  const msg = {
    message_id: 51,
    video: {
      file_id: 'vid_1',
      file_unique_id: 'uvid_1',
      file_name: 'tutorial.mp4',
      width: 1920,
      height: 1080,
      duration: 120,
      file_size: 15000000,
    },
  };

  const parsed = parseIncomingMedia(msg);
  assert.equal(parsed.mediaType, 'video');
  assert.equal(parsed.width, 1920);
  assert.equal(parsed.height, 1080);
});

test('parseIncomingMedia: Voice media extraction', () => {
  const msg = {
    message_id: 52,
    voice: {
      file_id: 'voice_1',
      file_unique_id: 'uvoice_1',
      duration: 15,
      mime_type: 'audio/ogg',
      file_size: 32000,
    },
  };

  const parsed = parseIncomingMedia(msg);
  assert.equal(parsed.mediaType, 'voice');
  assert.equal(parsed.durationSeconds, 15);
});

test('getUserFiles: Handles pagination calculations correctly', async () => {
  const userId = 500;
  const now = Math.floor(Date.now() / 1000);

  // Insert 12 files
  for (let i = 1; i <= 12; i++) {
    await db.insert(files).values({
      share_token: `f_userFile_${i}`,
      owner_user_id: userId,
      admin_user_id: userId,
      status: 'ACTIVE',
      source_chat_id: userId,
      source_message_id: i,
      media_type: 'document',
      file_name: `doc_${i}.pdf`,
      received_at: now + i,
      created_at: now + i,
      updated_at: now + i,
    });
  }

  // Page 1 (pageSize 5)
  const page1 = await getUserFiles(userId, 1, 5);
  assert.equal(page1.totalFiles, 12);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.files.length, 5);

  // Page 3 (pageSize 5) -> remaining 2 files
  const page3 = await getUserFiles(userId, 3, 5);
  assert.equal(page3.currentPage, 3);
  assert.equal(page3.files.length, 2);
});

test('Session: Rejects invalid step transition (step mismatch)', async () => {
  const userId = 600;
  await createUploadSession({ userId, fileId: 99, promptMessageId: 10 });

  // Attempting to jump directly from WAITING_CAPTION to an invalid step or mismatch expected step
  await assert.rejects(
    () => transitionSessionStep({
      userId,
      currentStep: 'WAITING_EXPIRY', // Mismatch! Active is WAITING_CAPTION
      nextStep: 'ARCHIVING',
    }),
    (err) => err.code === 'INVALID_STATE'
  );
});
