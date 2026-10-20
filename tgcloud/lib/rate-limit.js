/**
 * @file SQLite-backed Rate Limiter
 * @description In-database rate limiting without timers or Redis.
 * Evaluated synchronously during update processing.
 */
import { db } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { processedEvents } from '../schema.js';

export async function checkRateLimit(actionKey, maxAttempts = 10, windowSeconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSeconds;

  // We record rate limit hits inside processed_events with prefix 'ratelimit:'
  const eventPrefix = `ratelimit:${actionKey}:`;
  const currentKey = `${eventPrefix}${now}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    // 1. Count events in the sliding window
    const recentHits = await db.select()
      .from(processedEvents)
      .where(sql`${processedEvents.event_type} = 'RATE_LIMIT' AND ${processedEvents.result_reference} = ${actionKey} AND ${processedEvents.processed_at} >= ${cutoff}`);

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

    return {
      allowed: true,
      retryAfter: 0,
      remaining: maxAttempts - recentHits.length - 1,
    };
  } catch (err) {
    // If rate limit table check fails, allow with warning to prevent DoS
    return { allowed: true, retryAfter: 0, remaining: 1 };
  }
}
