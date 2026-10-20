/**
 * @file Telegram Serverless Native Message Handler
 * @description Handles incoming user messages, commands, deep links, and file uploads.
 */
import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { upsertUser } from '../lib/users.js';
import { claimEvent } from '../lib/idempotency.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { parseIncomingMedia } from '../lib/file-parser.js';
import {
  createFileDraft,
  getUserFiles,
  getSystemStats,
  getFileById,
} from '../lib/files.js';
import {
  getActiveSession,
  createUploadSession,
  transitionSessionStep,
  cancelSession,
  completeSession,
} from '../lib/sessions.js';
import { archiveFileToChannel } from '../lib/archive.js';
import { deliverFileByToken } from '../lib/delivery.js';
import { extractShareToken, buildDeepLink } from '../lib/links.js';
import { parseExpirationDays, calculateExpiresAt } from '../lib/expiration.js';
import { getConfig } from '../lib/config.js';
import {
  getMainMenuKeyboard,
  getCaptionKeyboard,
  getExpirationKeyboard,
  getUploadSuccessKeyboard,
  getMyFilesPaginationKeyboard,
} from '../lib/keyboards.js';
import {
  getWelcomeMessage,
  getHelpMessage,
  getPrivacyMessage,
  getCaptionPromptMessage,
  getExpirationPromptMessage,
  getUploadSuccessMessage,
  getStatsMessage,
} from '../lib/messages.js';
import { files } from '../schema.js';
import { SESSION_STEP, LIMITS, ERROR_CODES } from '../lib/constants.js';
import { BotAppError } from '../lib/errors.js';
import { logEvent } from '../lib/logging.js';

export default async function handleMessage(message, ctx) {
  if (!message || !message.from) return;

  const startTime = Date.now();
  const userId = message.from.id;
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  try {
    // 1. Audit user
    await upsertUser(message.from);

    // 2. Idempotency claim
    const eventKey = `msg_${chatId}_${message.message_id}`;
    const claimed = await claimEvent(eventKey, 'MESSAGE');
    if (!claimed) {
      return; // Already processed
    }

    // 3. Deep link delivery (/start f_xxx)
    const shareToken = extractShareToken(text);
    if (shareToken) {
      const rateCheck = await checkRateLimit(`dl:${userId}`, LIMITS.RATE_LIMIT_DOWNLOAD_MAX, LIMITS.RATE_LIMIT_DOWNLOAD_WINDOW_SEC);
      if (!rateCheck.allowed) {
        await api.sendMessage({
          chat_id: chatId,
          text: `⏳ لطفاً کمی صبر کنید. تعداد درخواست‌های دانلود بیش از حد مجاز است (${rateCheck.retryAfter} ثانیه دیگر).`,
        });
        return;
      }

      await deliverFileByToken({
        shareToken,
        receiverChatId: chatId,
        receiverUserId: userId,
      });
      return;
    }

    // 4. Command: /start (without params)
    if (text === '/start') {
      await api.sendMessage({
        chat_id: chatId,
        text: getWelcomeMessage(message.from.first_name),
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      });
      return;
    }

    // 5. Command: /help or menu button
    if (text === '/help' || text === 'ℹ️ راهنما') {
      await api.sendMessage({
        chat_id: chatId,
        text: getHelpMessage(),
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      });
      return;
    }

    // 6. Command: /privacy or menu button
    if (text === '/privacy' || text === '🔒 حریم خصوصی') {
      await api.sendMessage({
        chat_id: chatId,
        text: getPrivacyMessage(),
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      });
      return;
    }

    // 7. Command: /cancel
    if (text === '/cancel' || text === '❌ لغو عملیات') {
      const cancelled = await cancelSession(userId, 'USER_CANCELLED');
      const cancelText = cancelled
        ? '✅ عملیات آپلود فعلی لغو شد. می‌توانید فایل جدیدی ارسال کنید.'
        : 'ℹ️ در حال حاضر هیچ عملیات فعالی برای لغو کردن وجود ندارد.';
      await api.sendMessage({
        chat_id: chatId,
        text: cancelText,
        reply_markup: getMainMenuKeyboard(),
      });
      return;
    }

    // 8. Command: /stats or menu button
    if (text === '/stats' || text === '📊 آمار من') {
      const stats = await getSystemStats();
      await api.sendMessage({
        chat_id: chatId,
        text: getStatsMessage(stats),
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      });
      return;
    }

    // 9. Command: /myfiles or menu button
    if (text === '/myfiles' || text === '📁 فایل‌های من') {
      const { files: userFiles, totalFiles, totalPages } = await getUserFiles(userId, 1, 5);
      if (totalFiles === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: '📁 شما هنوز فایلی آپلود نکرده‌اید. برای اشتراک‌گذاری، یک فایل برای من بفرستید!',
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      await api.sendMessage({
        chat_id: chatId,
        text: `📁 <b>لیست فایل‌های شما</b> (مجموع: ${totalFiles} فایل)\nجهت مشاهده جزئیات و لینک، روی فایل موردنظر کلیک کنید:`,
        parse_mode: 'HTML',
        reply_markup: getMyFilesPaginationKeyboard(1, totalPages, userFiles),
      });
      return;
    }

    if (text === '📤 ارسال فایل جدید') {
      await api.sendMessage({
        chat_id: chatId,
        text: '📥 لطفاً فایل خود را (سند، تصویر، ویدئو، آهنگ، ویس یا گیف) ارسال یا فوروارد کنید:',
      });
      return;
    }

    // 10. Check active session input (Caption or Expiration entered via text)
    const activeSession = await getActiveSession(userId);

    if (activeSession) {
      if (activeSession.step === SESSION_STEP.WAITING_CAPTION) {
        // User typed a custom caption
        if (text.length > LIMITS.MAX_CAPTION_LENGTH) {
          await api.sendMessage({
            chat_id: chatId,
            text: `⚠️ طول کپشن نمی‌تواند بیشتر از ${LIMITS.MAX_CAPTION_LENGTH} کاراکتر باشد. لطفاً کپشن کوتاه‌تری ارسال کنید یا دکمه «بدون کپشن» را بزنید.`,
            reply_markup: getCaptionKeyboard(),
          });
          return;
        }

        // Save caption on the draft file
        await db.update(files)
          .set({ caption: text, updated_at: Math.floor(Date.now() / 1000) })
          .where(eq(files.id, activeSession.file_id));

        // Advance to WAITING_EXPIRY
        const promptRes = await api.sendMessage({
          chat_id: chatId,
          text: getExpirationPromptMessage(),
          parse_mode: 'HTML',
          reply_markup: getExpirationKeyboard(),
        });

        await transitionSessionStep({
          userId,
          currentStep: SESSION_STEP.WAITING_CAPTION,
          nextStep: SESSION_STEP.WAITING_EXPIRY,
          promptMessageId: promptRes?.message_id,
        });
        return;
      }

      if (activeSession.step === SESSION_STEP.WAITING_EXPIRY) {
        // User typed numeric expiration days
        const parseRes = parseExpirationDays(text);
        if (!parseRes.valid) {
          await api.sendMessage({
            chat_id: chatId,
            text: `⚠️ ${parseRes.error}\n\nلطفاً یک عدد صحیح بین ۱ تا ۳۶۵۰ ارسال نمایید یا از دکمه‌های آماده استفاده کنید:`,
            reply_markup: getExpirationKeyboard(),
          });
          return;
        }

        // Set expiration days on file
        await db.update(files)
          .set({
            expiration_days: parseRes.days,
            updated_at: Math.floor(Date.now() / 1000),
          })
          .where(eq(files.id, activeSession.file_id));

        // Archive to channel
        await api.sendMessage({
          chat_id: chatId,
          text: '⏳ در حال ذخیره‌سازی و ایجاد لینک اختصاصی...',
        });

        const archivedFile = await archiveFileToChannel(activeSession.file_id);
        await completeSession(userId);

        const botUsername = await getConfig('BOT_USERNAME');
        const shareLink = buildDeepLink(botUsername, archivedFile.share_token);

        const successText = getUploadSuccessMessage({
          fileName: archivedFile.file_name,
          fileSize: archivedFile.file_size_bytes,
          caption: archivedFile.caption,
          expirationText: `${parseRes.days} روز`,
          shareLink,
        });

        await api.sendMessage({
          chat_id: chatId,
          text: successText,
          parse_mode: 'HTML',
          reply_markup: getUploadSuccessKeyboard(shareLink),
        });
        return;
      }
    }

    // 11. Parse incoming media (Upload flow starts)
    const parsedMedia = parseIncomingMedia(message);
    if (parsedMedia) {
      // Check rate limit for uploads
      const uploadRate = await checkRateLimit(`up:${userId}`, LIMITS.RATE_LIMIT_UPLOAD_MAX, LIMITS.RATE_LIMIT_UPLOAD_WINDOW_SEC);
      if (!uploadRate.allowed) {
        await api.sendMessage({
          chat_id: chatId,
          text: `⏳ شما در هر دقیقه مجاز به آپلود حداکثر ${LIMITS.RATE_LIMIT_UPLOAD_MAX} فایل هستید. لطفاً ${uploadRate.retryAfter} ثانیه دیگر مجدداً تلاش فرمایید.`,
        });
        return;
      }

      // Check if user already has an active session
      if (activeSession) {
        await api.sendMessage({
          chat_id: chatId,
          text: '⚠️ شما یک آپلود در حال پردازش دارید. لطفاً ابتدا کپشن یا انقضای آن را مشخص کنید یا با ارسال /cancel آن را لغو نمایید.',
          reply_markup: getCaptionKeyboard(),
        });
        return;
      }

      // Create file draft in SQLite
      const fileDraft = await createFileDraft({
        ownerUserId: userId,
        parsedMedia,
        sourceChatId: chatId,
        sourceMessageId: message.message_id,
        rawMessage: message,
      });

      // Prompt for caption
      const promptRes = await api.sendMessage({
        chat_id: chatId,
        text: getCaptionPromptMessage(),
        parse_mode: 'HTML',
        reply_markup: getCaptionKeyboard(),
      });

      // Start upload session
      await createUploadSession({
        userId,
        fileId: fileDraft.id,
        promptMessageId: promptRes?.message_id,
      });
      return;
    }

    // Unrecognized text or fallback
    if (text) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'متوجه پیام شما نشدم. برای اشتراک‌گذاری یک فایل برای من بفرستید یا از منوی زیر استفاده کنید:',
        reply_markup: getMainMenuKeyboard(),
      });
    }
  } catch (err) {
    const userMessage = err instanceof BotAppError ? err.userMessage : '⚠️ خطایی در پردازش رخ داد. لطفاً دوباره تلاش فرمایید.';
    logEvent({
      eventType: 'MESSAGE_HANDLER_ERROR',
      userId,
      operation: 'handleMessage',
      status: 'ERROR',
      errorCode: err?.code || 'UNKNOWN',
      durationMs: Date.now() - startTime,
      extra: { error: err?.message },
    });

    try {
      await api.sendMessage({
        chat_id: chatId,
        text: userMessage,
        reply_markup: getMainMenuKeyboard(),
      });
    } catch (sendErr) {
      // Ignore if user blocked bot
    }
  }
}
