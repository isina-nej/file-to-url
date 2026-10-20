/**
 * @file Delivery Service
 * @description Handles file delivery via Telegram deep links with lazy expiration checking,
 * access control, fallback handling, and atomic delivery metric tracking.
 */
import { api, db, BotApiError } from 'sdk';
import { eq, sql } from 'sdk/db';
import { files, fileDeliveries } from '../schema.js';
import { FILE_STATUS, ERROR_CODES } from './constants.js';
import { isFileExpired } from './expiration.js';
import { BotAppError } from './errors.js';
import { logEvent } from './logging.js';

export async function deliverFileByToken({ shareToken, receiverChatId, receiverUserId }) {
  const startTime = Date.now();
  const now = Math.floor(Date.now() / 1000);

  // 1. Fetch file by share token
  const fileRows = await db.select().from(files).where(eq(files.share_token, shareToken)).limit(1);

  if (fileRows.length === 0) {
    throw new BotAppError(
      ERROR_CODES.NOT_FOUND,
      `Share token not found: ${shareToken.substring(0, 8)}...`,
      '❌ فایل موردنظر پیدا نشد یا لینک معتبر نیست.'
    );
  }

  const file = fileRows[0];

  // 2. Check Disabled status
  if (file.status === FILE_STATUS.DISABLED) {
    throw new BotAppError(
      ERROR_CODES.DISABLED,
      'File is disabled by owner.',
      '🚫 صاحب فایل دسترسی به این لینک را غیرفعال کرده است.'
    );
  }

  // 3. Check Lazy Expiration
  if (isFileExpired(file, now)) {
    // Lazily mark status in DB as EXPIRED if not already updated
    if (file.status !== FILE_STATUS.EXPIRED) {
      await db.update(files)
        .set({ status: FILE_STATUS.EXPIRED, updated_at: now })
        .where(eq(files.id, file.id));
    }

    throw new BotAppError(
      ERROR_CODES.EXPIRED,
      'File has expired.',
      '⏳ مهلت دریافت این فایل به پایان رسیده است.'
    );
  }

  // 4. Check Active Status & Storage IDs
  if (file.status !== FILE_STATUS.ACTIVE || !file.storage_chat_id || !file.storage_message_id) {
    throw new BotAppError(
      ERROR_CODES.INVALID_STATE,
      `File status is ${file.status}. Not ready for delivery.`,
      '⚠️ این فایل هنوز آماده دریافت نیست یا با خطا مواجه شده است.'
    );
  }

  // 5. Deliver file using api.copyMessage
  let sentMessageId = null;
  let deliverySuccess = false;
  let lastErrorCode = null;

  try {
    const copyResult = await api.copyMessage({
      chat_id: receiverChatId,
      from_chat_id: file.storage_chat_id,
      message_id: file.storage_message_id,
    });

    if (copyResult && copyResult.message_id) {
      sentMessageId = copyResult.message_id;
      deliverySuccess = true;
    }
  } catch (err) {
    lastErrorCode = err instanceof BotApiError ? `BOT_API_${err.code || 'ERROR'}` : 'COPY_FAILED';

    // 6. Fallback route: If channel copy fails but telegram_file_id is available, attempt media delivery
    if (file.telegram_file_id) {
      try {
        const fallbackRes = await deliverViaFileId(file, receiverChatId);
        if (fallbackRes?.message_id) {
          sentMessageId = fallbackRes.message_id;
          deliverySuccess = true;
          lastErrorCode = null;
        }
      } catch (fallbackErr) {
        lastErrorCode = `FALLBACK_FAILED_${fallbackErr?.message || ''}`.substring(0, 50);
      }
    }

    if (!deliverySuccess) {
      // Record delivery failure
      await db.insert(fileDeliveries).values({
        file_id: file.id,
        receiver_user_id: receiverUserId,
        request_key: `req_${now}_${receiverUserId}`,
        requested_at: now,
        delivered_at: null,
        sent_message_id: null,
        status: 'FAILED',
        error_code: lastErrorCode,
      });

      // Increment error count
      await db.update(files)
        .set({
          delivery_error_count: sql`${files.delivery_error_count} + 1`,
          last_error_code: lastErrorCode,
          updated_at: now,
        })
        .where(eq(files.id, file.id));

      logEvent({
        eventType: 'DELIVERY_FAILURE',
        userId: receiverUserId,
        fileId: file.id,
        operation: 'copyMessage',
        status: 'ERROR',
        errorCode: lastErrorCode,
        durationMs: Date.now() - startTime,
      });

      throw new BotAppError(
        ERROR_CODES.DELIVERY_FAILED,
        `Delivery failed: ${lastErrorCode}`,
        '⚠️ در حال حاضر امکان ارسال این فایل وجود ندارد. لطفاً بعداً دوباره تلاش کنید.',
        err
      );
    }
  }

  // 7. Atomic update on successful delivery
  await db.update(files)
    .set({
      download_count: sql`${files.download_count} + 1`,
      last_download_at: now,
      updated_at: now,
    })
    .where(eq(files.id, file.id));

  // 8. Record successful delivery
  await db.insert(fileDeliveries).values({
    file_id: file.id,
    receiver_user_id: receiverUserId,
    request_key: `req_${now}_${receiverUserId}`,
    requested_at: now,
    delivered_at: now,
    sent_message_id: sentMessageId,
    status: 'SUCCESS',
    error_code: null,
  });

  logEvent({
    eventType: 'DELIVERY_SUCCESS',
    userId: receiverUserId,
    fileId: file.id,
    operation: 'copyMessage',
    status: 'SUCCESS',
    durationMs: Date.now() - startTime,
  });

  return { file, sentMessageId };
}

/**
 * Fallback delivery using sendDocument, sendPhoto, etc. with telegram_file_id
 */
async function deliverViaFileId(file, chatId) {
  const fileId = file.telegram_file_id;
  const caption = file.caption || undefined;

  switch (file.media_type) {
    case 'document':
      return api.sendDocument({ chat_id: chatId, document: fileId, caption });
    case 'photo':
      return api.sendPhoto({ chat_id: chatId, photo: fileId, caption });
    case 'video':
      return api.sendVideo({ chat_id: chatId, video: fileId, caption });
    case 'audio':
      return api.sendAudio({ chat_id: chatId, audio: fileId, caption });
    case 'animation':
      return api.sendAnimation({ chat_id: chatId, animation: fileId, caption });
    case 'voice':
      return api.sendVoice({ chat_id: chatId, voice: fileId, caption });
    default:
      return api.sendDocument({ chat_id: chatId, document: fileId, caption });
  }
}
