/**
 * @file SQLite-backed Rate Limiter
 * @description In-database rate limiting without timers or Redis.
 * Evaluated synchronously during update processing with automatic cleanup of expired entries.
 */
import { db } from 'sdk';
import { sql } from 'sdk/db';
import { processedEvents } from '../schema.js';

export async function checkRateLimit(actionKey, maxAttempts = 10, windowSeconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSeconds;

  const eventPrefix = `ratelimit:${actionKey}:`;
  const currentKey = `${eventPrefix}${now}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    // 1. Count events in the sliding window
    const recentHits = await db.select()
      .from(processedEvents)
      .where(
        sql`${processedEvents.event_type} = 'RATE_LIMIT' AND ${processedEvents.result_reference} = ${actionKey} AND ${processedEvents.processed_at} >= ${cutoff}`
      );

    if (recentHits.length >= maxAttempts) {
      return {
        allowed: false,
        retryAfter: Math.max(1, cutoff + windowSeconds - now),
        remaining: 0,
      };
    }

    // 2. Record hit
    await db.insert(processedEvents).values({
      event_key: currentKey,
      event_type: 'RATE_LIMIT',
      processed_at: now,
      result_reference: actionKey,
    });

    // 3. Lazy cleanup: prune entries older than 2 hours to keep database compact (1 in 20 requests)
    if (Math.random() < 0.05) {
      const purgeCutoff = now - 7200;
      await db.delete(processedEvents).where(
        sql`${processedEvents.event_type} = 'RATE_LIMIT' AND ${processedEvents.processed_at} < ${purgeCutoff}`
      );
    }

    return {
      allowed: true,
      retryAfter: 0,
      remaining: maxAttempts - recentHits.length - 1,
    };
  } catch (err) {
    console.error('Rate limit evaluation error:', err);
    // On DB failure, allow but with minimum remaining to avoid full denial on minor DB hiccup
    return { allowed: true, retryAfter: 0, remaining: 1 };
  }
}
