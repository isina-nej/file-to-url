/**
 * @file Application Configuration
 * @description In Telegram Serverless runtime, configuration is kept in SQLite (app_settings)
 * or fallback defaults. No process.env in V8 Isolate.
 */
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { appSettings } from '../schema.js';

const DEFAULT_CONFIG = {
  STORAGE_CHANNEL_ID: '-1001234567890',
  OWNER_TELEGRAM_ID: '12345678',
  BOT_USERNAME: 'FileLinkBot',
};

// In-memory request cache for the isolate lifetime
let cachedSettings = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60000;

export async function getConfig(key) {
  const now = Date.now();
  if (cachedSettings && (now - cacheTime < CACHE_TTL_MS)) {
    return cachedSettings[key] ?? DEFAULT_CONFIG[key] ?? null;
  }

  try {
    const rows = await db.select().from(appSettings);
    const map = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    cachedSettings = map;
    cacheTime = now;
    return cachedSettings[key] ?? DEFAULT_CONFIG[key] ?? null;
  } catch (err) {
    // If DB read fails during bootstrap, use default
    return DEFAULT_CONFIG[key] ?? null;
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
    return false;
  }
}

export function clearConfigCache() {
  cachedSettings = null;
  cacheTime = 0;
}
