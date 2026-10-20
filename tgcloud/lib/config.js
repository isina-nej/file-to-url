/**
 * @file Application Configuration
 * @description Loads runtime configuration from SQLite (app_settings) in Telegram Serverless.
 * Implements strict fail-closed behavior without insecure dummy placeholders.
 */
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { appSettings } from '../schema.js';
import { ERROR_CODES } from './constants.js';
import { BotAppError } from './errors.js';

// In-memory request cache for isolate lifetime
let cachedSettings = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30000;

export async function getConfig(key) {
  const now = Date.now();
  if (cachedSettings && (now - cacheTime < CACHE_TTL_MS)) {
    return cachedSettings[key] ?? null;
  }

  try {
    const rows = await db.select().from(appSettings);
    const map = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    cachedSettings = map;
    cacheTime = now;
    return cachedSettings[key] ?? null;
  } catch (err) {
    // If DB throws error, propagate as database error rather than returning fake values
    throw new BotAppError(
      ERROR_CODES.DATABASE_ERROR,
      `Failed to read app_settings from database: ${err?.message || ''}`,
      '⚠️ دسترسی به تنظیمات سیستم با خطا مواجه شد. لطفاً بررسی کنید دیتابیس در دسترس باشد.',
      err
    );
  }
}

export async function setConfig(key, value) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(appSettings)
        .set({ value: String(value), updated_at: now })
        .where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({
        key,
        value: String(value),
        updated_at: now,
      });
    }
    if (cachedSettings) {
      cachedSettings[key] = String(value);
    }
    return true;
  } catch (err) {
    console.error(`Failed to setConfig ${key}:`, err);
    return false;
  }
}

export function clearConfigCache() {
  cachedSettings = null;
  cacheTime = 0;
}
