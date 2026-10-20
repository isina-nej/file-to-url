/**
 * @file Idempotency Layer
 * @description Prevents duplicate handling of Telegram updates and callbacks.
 * Distinguishes true unique constraint violations from unexpected database errors.
 */
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { processedEvents } from '../schema.js';
import { ERROR_CODES } from './constants.js';
import { BotAppError } from './errors.js';

export async function claimEvent(eventKey, eventType = 'TELEGRAM_UPDATE') {
  if (!eventKey) return true;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Attempt insert into processed_events table
    await db.insert(processedEvents).values({
      event_key: String(eventKey),
      event_type: eventType,
      processed_at: now,
      result_reference: 'CLAIMED',
    });
    return true; // Successfully claimed
  } catch (err) {
    const errMsg = String(err?.message || '');
    // Only treat genuine UNIQUE constraint collisions as already processed
    if (
      errMsg.includes('UNIQUE constraint failed') ||
      errMsg.includes('constraint failed') ||
      err?.code === 'SQLITE_CONSTRAINT' ||
      err?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
    ) {
      return false; // Legitimate duplicate event
    }

    // Unexpected database failure or syntax error: must NOT be masked as a duplicate
    throw new BotAppError(
      ERROR_CODES.DATABASE_ERROR,
      `Database error during idempotency check: ${errMsg}`,
      '⚠️ خطای موقت در پایگاه‌داده رخ داده است. لطفاً چند لحظه بعد مجدداً تلاش نمایید.',
      err
    );
  }
}

export async function isEventClaimed(eventKey) {
  if (!eventKey) return false;
  const existing = await db.select()
    .from(processedEvents)
    .where(eq(processedEvents.event_key, String(eventKey)))
    .limit(1);
  return existing.length > 0;
}
