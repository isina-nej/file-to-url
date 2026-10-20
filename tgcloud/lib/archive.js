/**
 * @file Archive Service
 * @description Copies uploaded files to the private storage channel via api.copyMessage.
 * Zero file downloading/re-uploading to maintain native serverless lightweight efficiency.
 */
import { api, db, BotApiError } from 'sdk';
import { eq, and } from 'sdk/db';
import { files } from '../schema.js';
import { FILE_STATUS, ERROR_CODES } from './constants.js';
import { getConfig } from './config.js';
import { BotAppError } from './errors.js';
import { logEvent } from './logging.js';

export async function archiveFileToChannel(fileId) {
  const startTime = Date.now();
  const fileRows = await db.select().from(files).where(eq(files.id, fileId)).limit(1);

  if (fileRows.length === 0) {
    throw new BotAppError(ERROR_CODES.NOT_FOUND, `File #${fileId} not found.`);
  }

  const file = fileRows[0];

  // Prevent double archiving
  if (file.status === FILE_STATUS.ACTIVE && file.storage_message_id) {
    return file;
  }

  const storageChannelId = await getConfig('STORAGE_CHANNEL_ID');
  if (!storageChannelId) {
    throw new BotAppError(
      ERROR_CODES.STORAGE_UNAVAILABLE,
      'Storage channel ID is not configured.',
      '⚠️ شناسه کانال ذخیره‌سازی تنظیم نشده است. لطفاً با ادمین ربات تماس بگیرید.'
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // Transition state to ARCHIVING
  await db.update(files)
    .set({ status: FILE_STATUS.ARCHIVING, updated_at: now })
    .where(and(eq(files.id, fileId), eq(files.status, FILE_STATUS.WAITING_EXPIRY)));

  try {
    const copyPayload = {
      chat_id: storageChannelId,
      from_chat_id: file.source_chat_id,
      message_id: file.source_message_id,
    };

    // If explicit caption is set, pass it; if empty string, it clears original caption
    if (file.caption !== null && file.caption !== undefined) {
      copyPayload.caption = file.caption;
    }

    // Call Telegram Bot API copyMessage
    const copyResult = await api.copyMessage(copyPayload);

    if (!copyResult || !copyResult.message_id) {
      throw new Error('Invalid response from copyMessage: missing message_id');
    }

    const storageMessageId = copyResult.message_id;
    const publishedAt = Math.floor(Date.now() / 1000);

    // Calculate final expires_at if expiration_days was selected
    let expiresAt = null;
    if (file.expiration_days) {
      expiresAt = publishedAt + (file.expiration_days * 86400);
    }

    // Persist storage metadata and activate file
    await db.update(files)
      .set({
        storage_chat_id: Number(storageChannelId),
        storage_message_id: storageMessageId,
        status: FILE_STATUS.ACTIVE,
        archived_at: publishedAt,
        published_at: publishedAt,
        expires_at: expiresAt,
        updated_at: publishedAt,
      })
      .where(eq(files.id, fileId));

    logEvent({
      eventType: 'ARCHIVE_SUCCESS',
      userId: file.owner_user_id,
      fileId: file.id,
      operation: 'copyMessage',
      status: 'SUCCESS',
      durationMs: Date.now() - startTime,
    });

    return {
      ...file,
      storage_chat_id: Number(storageChannelId),
      storage_message_id: storageMessageId,
      status: FILE_STATUS.ACTIVE,
      archived_at: publishedAt,
      published_at: publishedAt,
      expires_at: expiresAt,
    };
  } catch (err) {
    const errorCode = err instanceof BotApiError ? `BOT_API_${err.code || 'ERROR'}` : 'ARCHIVE_FAILED';
    const errorDetails = err?.description || err?.message || 'Unknown archive error';

    await db.update(files)
      .set({
        status: FILE_STATUS.ARCHIVE_FAILED,
        last_error_code: `${errorCode}: ${errorDetails.substring(0, 100)}`,
        updated_at: Math.floor(Date.now() / 1000),
      })
      .where(eq(files.id, fileId));

    logEvent({
      eventType: 'ARCHIVE_FAILURE',
      userId: file.owner_user_id,
      fileId: file.id,
      operation: 'copyMessage',
      status: 'ERROR',
      errorCode,
      durationMs: Date.now() - startTime,
      extra: { error: errorDetails },
    });

    throw new BotAppError(
      ERROR_CODES.ARCHIVE_FAILED,
      `Archive failed: ${errorDetails}`,
      '⚠️ ذخیره‌سازی فایل در کانال با خطا مواجه شد. لطفاً بررسی کنید ربات در کانال آرشیو ادمین باشد و دسترسی ارسال پیام داشته باشد.',
      err
    );
  }
}
