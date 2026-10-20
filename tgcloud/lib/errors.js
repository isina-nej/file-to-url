/**
 * @file Error Handling Layer
 * @description Domain errors with user-friendly Persian explanations and status codes.
 */
import { ERROR_CODES } from './constants.js';

export class BotAppError extends Error {
  constructor(code, message, userMessage = null, originalError = null) {
    super(message);
    this.name = 'BotAppError';
    this.code = code;
    this.userMessage = userMessage || getDefaultUserMessage(code);
    this.originalError = originalError;
  }
}

export function getDefaultUserMessage(code) {
  switch (code) {
    case ERROR_CODES.NOT_FOUND:
      return '❌ فایل موردنظر پیدا نشد یا لینک معتبر نیست.';
    case ERROR_CODES.EXPIRED:
      return '⏳ مهلت دریافت این فایل به پایان رسیده است.';
    case ERROR_CODES.DISABLED:
      return '🚫 صاحب فایل دسترسی به این لینک را غیرفعال کرده است.';
    case ERROR_CODES.STORAGE_UNAVAILABLE:
    case ERROR_CODES.ARCHIVE_FAILED:
      return '⚠️ ذخیره‌سازی فایل در حال حاضر با مشکل مواجه شده است. لطفاً کمی بعد دوباره تلاش کنید.';
    case ERROR_CODES.DELIVERY_FAILED:
      return '⚠️ در حال حاضر امکان دریافت این فایل وجود ندارد. لطفاً بعداً دوباره تلاش کنید.';
    case ERROR_CODES.TELEGRAM_RATE_LIMIT:
      return '⏳ تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً چند لحظه صبر کنید.';
    case ERROR_CODES.VALIDATION_ERROR:
      return '⚠️ مقدار ورودی معتبر نیست. لطفاً طبق راهنما عمل کنید.';
    case ERROR_CODES.UNAUTHORIZED:
      return '⛔️ شما مجوز انجام این عملیات را ندارید.';
    case ERROR_CODES.MEDIA_NOT_SUPPORTED:
      return '⚠️ این نوع رسانه پشتیبانی نمی‌شود. لطفاً فایل، عکس، ویدئو، آهنگ یا ویس ارسال کنید.';
    default:
      return '⚠️ خطایی رخ داد. لطفاً دوباره تلاش کنید.';
  }
}
