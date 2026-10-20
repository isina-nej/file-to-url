/**
 * @file User Management
 * @description Upserts user records in SQLite and maintains audit timestamps.
 */
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';

export async function upsertUser(telegramUser) {
  if (!telegramUser || !telegramUser.id) return null;
  const now = Math.floor(Date.now() / 1000);

  const existing = await db.select()
    .from(users)
    .where(eq(users.telegram_id, telegramUser.id))
    .limit(1);

  if (existing.length > 0) {
    await db.update(users)
      .set({
        username: telegramUser.username || null,
        first_name: telegramUser.first_name || '',
        last_name: telegramUser.last_name || null,
        language_code: telegramUser.language_code || null,
        last_seen_at: now,
        updated_at: now,
      })
      .where(eq(users.telegram_id, telegramUser.id));

    return { ...existing[0], last_seen_at: now, updated_at: now };
  }

  const newUser = {
    telegram_id: telegramUser.id,
    username: telegramUser.username || null,
    first_name: telegramUser.first_name || '',
    last_name: telegramUser.last_name || null,
    language_code: telegramUser.language_code || null,
    is_bot: telegramUser.is_bot ? 1 : 0,
    is_blocked: 0,
    created_at: now,
    updated_at: now,
    last_seen_at: now,
  };

  await db.insert(users).values(newUser);
  return newUser;
}
