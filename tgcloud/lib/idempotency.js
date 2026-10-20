/**
 * @file Idempotency Layer
 * @description Prevents duplicate handling of Telegram updates and callbacks.
 */
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { processedEvents } from '../schema.js';

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
    // Unique constraint violation means event was already processed
    return false;
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
