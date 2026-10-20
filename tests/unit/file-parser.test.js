/**
 * @file Unit Tests: Telegram Media and File Parser
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIncomingMedia } from '../../tgcloud/lib/file-parser.js';
import { BotAppError } from '../../tgcloud/lib/errors.js';

test('parseIncomingMedia: extracts Document correctly', () => {
  const msg = {
    message_id: 10,
    caption: 'سند تست',
    document: {
      file_id: 'doc_123',
      file_unique_id: 'udoc_123',
      file_name: 'thesis_final.pdf',
      mime_type: 'application/pdf',
      file_size: 1048576,
    },
  };

  const parsed = parseIncomingMedia(msg);
  assert.equal(parsed.mediaType, 'document');
  assert.equal(parsed.telegramFileId, 'doc_123');
  assert.equal(parsed.fileName, 'thesis_final.pdf');
  assert.equal(parsed.fileExtension, 'pdf');
  assert.equal(parsed.fileSizeBytes, 1048576);
  assert.equal(parsed.originalCaption, 'سند تست');
});

test('parseIncomingMedia: extracts Photo picking the highest resolution', () => {
  const msg = {
    message_id: 11,
    photo: [
      { file_id: 'small', file_unique_id: 'u_small', width: 100, height: 100, file_size: 5000 },
      { file_id: 'large', file_unique_id: 'u_large', width: 1200, height: 800, file_size: 150000 },
    ],
  };

  const parsed = parseIncomingMedia(msg);
  assert.equal(parsed.mediaType, 'photo');
  assert.equal(parsed.telegramFileId, 'large');
  assert.equal(parsed.width, 1200);
  assert.equal(parsed.height, 800);
});

test('parseIncomingMedia: rejects media groups (albums)', () => {
  const msg = {
    message_id: 12,
    media_group_id: 'album_9999',
    document: { file_id: 'doc_1' },
  };

  assert.throws(
    () => parseIncomingMedia(msg),
    (err) => err instanceof BotAppError && err.code === 'MEDIA_NOT_SUPPORTED'
  );
});

test('parseIncomingMedia: rejects stickers and video notes', () => {
  const stickerMsg = { message_id: 13, sticker: { file_id: 'stk_1' } };
  assert.throws(
    () => parseIncomingMedia(stickerMsg),
    (err) => err instanceof BotAppError && err.code === 'MEDIA_NOT_SUPPORTED'
  );

  const videoNoteMsg = { message_id: 14, video_note: { file_id: 'vn_1' } };
  assert.throws(
    () => parseIncomingMedia(videoNoteMsg),
    (err) => err instanceof BotAppError && err.code === 'MEDIA_NOT_SUPPORTED'
  );
});

test('parseIncomingMedia: rejects protected content', () => {
  const protectedMsg = {
    message_id: 15,
    has_protected_content: true,
    document: { file_id: 'prot_1' },
  };

  assert.throws(
    () => parseIncomingMedia(protectedMsg),
    (err) => err instanceof BotAppError && err.code === 'VALIDATION_ERROR'
  );
});
