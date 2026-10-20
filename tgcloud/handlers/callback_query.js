/**
 * @file Telegram Serverless Native Callback Query Handler
 * @description Handles inline keyboard button clicks: caption skip, expiration presets,
 * file pagination, and active/disabled link toggles.
 */
import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { upsertUser } from '../lib/users.js';
import { claimEvent } from '../lib/idempotency.js';
import {
  getActiveSession,
  transitionSessionStep,
  cancelSession,
  completeSession,
} from '../lib/sessions.js';
import {
  getUserFiles,
  getFileById,
  toggleFileStatus,
} from '../lib/files.js';
import { archiveFileToChannel } from '../lib/archive.js';
import { buildDeepLink } from '../lib/links.js';
import { getConfig } from '../lib/config.js';
import {
  getExpirationKeyboard,
  getUploadSuccessKeyboard,
  getMyFilesPaginationKeyboard,
  getFileActionsKeyboard,
  getMainMenuKeyboard,
} from '../lib/keyboards.js';
import {
  getExpirationPromptMessage,
  getUploadSuccessMessage,
  getFileDetailMessage,
} from '../lib/messages.js';
import { files } from '../schema.js';
import { SESSION_STEP, LIMITS, ERROR_CODES } from '../lib/constants.js';
import { BotAppError } from '../lib/errors.js';
import { logEvent } from '../lib/logging.js';

export default async function handleCallbackQuery(callbackQuery, ctx) {
  if (!callbackQuery || !callbackQuery.from) return;

  const startTime = Date.now();
  const userId = callbackQuery.from.id;
  const message = callbackQuery.message;
  const chatId = message?.chat?.id;
  const data = callbackQuery.data || '';

  // Always answer callback query to dismiss loading wheel in Telegram client
  try {
    await api.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
    });
  } catch (e) {
    // Ignore callback query answer failure
  }

  // Idempotency check on callback
  const eventKey = `cb_${callbackQuery.id}`;
  const claimed = await claimEvent(eventKey, 'CALLBACK_QUERY');
  if (!claimed) return;

  await upsertUser(callbackQuery.from);

  try {
    // 1. Cancel upload
    if (data === 'upload_cancel') {
      await cancelSession(userId, 'USER_CANCELLED');
      if (chatId && message?.message_id) {
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: '❌ عملیات آپلود لغو شد. می‌توانید هر زمان فایل جدیدی ارسال کنید.',
        });
      }
      return;
    }

    // 2. Skip caption ("بدون کپشن")
    if (data === 'caption_skip') {
      const activeSession = await getActiveSession(userId);
      if (!activeSession || activeSession.step !== SESSION_STEP.WAITING_CAPTION) {
        await api.sendMessage({
          chat_id: chatId,
          text: '⚠️ این مرحله قبلاً تکمیل شده یا منقضی گردیده است.',
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      // Explicitly set empty string to remove original caption if any
      await db.update(files)
        .set({ caption: '', updated_at: Math.floor(Date.now() / 1000) })
        .where(eq(files.id, activeSession.file_id));

      if (chatId && message?.message_id) {
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: getExpirationPromptMessage(),
          parse_mode: 'HTML',
          reply_markup: getExpirationKeyboard(),
        });
      }

      await transitionSessionStep({
        userId,
        currentStep: SESSION_STEP.WAITING_CAPTION,
        nextStep: SESSION_STEP.WAITING_EXPIRY,
        promptMessageId: message?.message_id,
      });
      return;
    }

    // 3. Expiration preset buttons (exp_1, exp_7, exp_30, exp_365, exp_never)
    if (data.startsWith('exp_')) {
      const activeSession = await getActiveSession(userId);
      if (!activeSession || activeSession.step !== SESSION_STEP.WAITING_EXPIRY) {
        await api.sendMessage({
          chat_id: chatId,
          text: '⚠️ این مرحله قبلاً تکمیل شده یا منقضی گردیده است.',
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      let expirationDays = null;
      let expirationText = 'بدون انقضا (دائمی)';

      if (data === 'exp_1') {
        expirationDays = 1;
        expirationText = '۱ روز';
      } else if (data === 'exp_7') {
        expirationDays = 7;
        expirationText = '۷ روز';
      } else if (data === 'exp_30') {
        expirationDays = 30;
        expirationText = '۳۰ روز';
      } else if (data === 'exp_365') {
        expirationDays = 365;
        expirationText = '۳۶۵ روز (۱ سال)';
      } else if (data === 'exp_never') {
        expirationDays = null;
        expirationText = 'بدون انقضا (دائمی)';
      }

      // Update file with expiration days
      await db.update(files)
        .set({
          expiration_days: expirationDays,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(files.id, activeSession.file_id));

      if (chatId && message?.message_id) {
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: '⏳ در حال ذخیره‌سازی و ایجاد لینک اختصاصی...',
        });
      }

      const archivedFile = await archiveFileToChannel(activeSession.file_id);
      await completeSession(userId);

      const botUsername = await getConfig('BOT_USERNAME');
      const shareLink = buildDeepLink(botUsername, archivedFile.share_token);

      const successText = getUploadSuccessMessage({
        fileName: archivedFile.file_name,
        fileSize: archivedFile.file_size_bytes,
        caption: archivedFile.caption,
        expirationText,
        shareLink,
      });

      if (chatId && message?.message_id) {
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: successText,
          parse_mode: 'HTML',
          reply_markup: getUploadSuccessKeyboard(shareLink),
        });
      }
      return;
    }

    // 4. My files pagination: myfiles_PAGE
    if (data.startsWith('myfiles_')) {
      const page = parseInt(data.replace('myfiles_', ''), 10) || 1;
      const { files: userFiles, totalFiles, totalPages } = await getUserFiles(userId, page, 5);

      if (totalFiles === 0) {
        if (chatId && message?.message_id) {
          await api.editMessageText({
            chat_id: chatId,
            message_id: message.message_id,
            text: '📁 شما هنوز فایلی آپلود نکرده‌اید. برای اشتراک‌گذاری، یک فایل برای من بفرستید!',
          });
        }
        return;
      }

      const textOutput = `📁 <b>لیست فایل‌های شما</b> (مجموع: ${totalFiles} فایل)\nجهت مشاهده جزئیات و لینک، روی فایل موردنظر کلیک کنید:`;

      if (chatId && message?.message_id) {
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: textOutput,
          parse_mode: 'HTML',
          reply_markup: getMyFilesPaginationKeyboard(page, totalPages, userFiles),
        });
      }
      return;
    }

    // 5. View file details: file_view_ID
    if (data.startsWith('file_view_')) {
      const fileId = parseInt(data.replace('file_view_', ''), 10);
      const file = await getFileById(fileId);

      if (!file || file.owner_user_id !== userId) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ فایل موردنظر یافت نشد یا شما اجازه مشاهده آن را ندارید.',
        });
        return;
      }

      const botUsername = await getConfig('BOT_USERNAME');
      const shareLink = buildDeepLink(botUsername, file.share_token);
      const detailText = getFileDetailMessage(file, shareLink);

      if (chatId && message?.message_id) {
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: detailText,
          parse_mode: 'HTML',
          reply_markup: getFileActionsKeyboard(file, shareLink),
        });
      }
      return;
    }

    // 6. Toggle file active/disabled: file_toggle_ID
    if (data.startsWith('file_toggle_')) {
      const fileId = parseInt(data.replace('file_toggle_', ''), 10);
      const toggleRes = await toggleFileStatus(fileId, userId);

      const file = await getFileById(fileId);
      const botUsername = await getConfig('BOT_USERNAME');
      const shareLink = buildDeepLink(botUsername, file.share_token);
      const detailText = getFileDetailMessage(file, shareLink);

      if (chatId && message?.message_id) {
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: detailText,
          parse_mode: 'HTML',
          reply_markup: getFileActionsKeyboard(file, shareLink),
        });
      }
      return;
    }

    // 7. Prompt new upload: new_upload
    if (data === 'new_upload') {
      await api.sendMessage({
        chat_id: chatId,
        text: '📥 لطفاً فایل خود را (سند، تصویر، ویدئو، آهنگ، ویس یا گیف) ارسال نمایید:',
        reply_markup: getMainMenuKeyboard(),
      });
      return;
    }
  } catch (err) {
    const userMessage = err instanceof BotAppError ? err.userMessage : '⚠️ خطایی در پردازش رخ داد. لطفاً دوباره تلاش نمایید.';
    logEvent({
      eventType: 'CALLBACK_ERROR',
      userId,
      operation: 'handleCallbackQuery',
      status: 'ERROR',
      errorCode: err?.code || 'UNKNOWN',
      durationMs: Date.now() - startTime,
      extra: { data, error: err?.message },
    });

    if (chatId) {
      await api.sendMessage({
        chat_id: chatId,
        text: userMessage,
      });
    }
  }
}
