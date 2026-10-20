/**
 * @file Expiration Logic and Digit Normalization
 * @description Validates expiration days (1 to 3650), normalizes Persian/Arabic numerals,
 * and performs lazy expiration calculation without cron jobs.
 */
import { LIMITS } from './constants.js';

/**
 * Normalizes Persian and Arabic numerals to ASCII digits.
 */
export function normalizeDigits(input) {
  if (typeof input !== 'string') {
    input = String(input ?? '');
  }
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = input.trim();
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(persianDigits[i], String(i));
    result = result.replaceAll(arabicDigits[i], String(i));
  }
  return result;
}

/**
 * Validates expiration input from user.
 * Accepts:
 * - integer between 1 and 3650
 * - returns { valid: true, days: number } or { valid: false, error: string }
 */
export function parseExpirationDays(input) {
  if (input === null || input === undefined || input === '') {
    return { valid: false, error: 'مقدار انقضا نمی‌تواند خالی باشد.' };
  }

  const normalized = normalizeDigits(String(input));

  // Must match strictly integer digits
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, error: 'لطفاً فقط یک عدد صحیح معتبر وارد کنید (بدون حروف یا اعشار).' };
  }

  const days = Number(normalized);

  if (!Number.isSafeInteger(days)) {
    return { valid: false, error: 'عدد وارد شده بیش از حد بزرگ است.' };
  }

  if (days < LIMITS.MIN_EXPIRATION_DAYS || days > LIMITS.MAX_EXPIRATION_DAYS) {
    return {
      valid: false,
      error: `تعداد روز باید بین ${LIMITS.MIN_EXPIRATION_DAYS} تا ${LIMITS.MAX_EXPIRATION_DAYS} باشد.`,
    };
  }

  return { valid: true, days };
}

/**
 * Calculates Unix epoch expires_at in seconds.
 */
export function calculateExpiresAt(publishedAt, expirationDays) {
  if (expirationDays === null || expirationDays === undefined) {
    return null;
  }
  return publishedAt + (expirationDays * LIMITS.SECONDS_PER_DAY);
}

/**
 * Lazy check if a file has expired.
 */
export function isFileExpired(file, currentTimestamp = null) {
  if (!file) return true;
  if (file.expires_at === null || file.expires_at === undefined) {
    return false; // Unlimited
  }
  const now = currentTimestamp ?? Math.floor(Date.now() / 1000);
  return now >= file.expires_at;
}
