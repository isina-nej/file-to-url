/**
 * @file Upload Session State Machine
 * @description Manages upload sessions in SQLite with concurrency versioning and lazy expiration.
 * Free of recursion bugs, with strict optimistic locking and atomic cleanup.
 */
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { uploadSessions, files } from '../schema.js';
import { SESSION_STEP, FILE_STATUS, LIMITS, ERROR_CODES } from './constants.js';
import { BotAppError } from './errors.js';

/**
 * Direct cleanup of expired sessions without recursive calls.
 */
async function expireSessionDirect(userId, fileId) {
  const now = Math.floor(Date.now() / 1000);
  try {
    // 1. Mark draft file as CANCELLED if still in draft phase
    if (fileId) {
      await db.update(files)
        .set({
          status: FILE_STATUS.CANCELLED,
          last_error_code: 'SESSION_EXPIRED',
          updated_at: now,
        })
        .where(
          and(
            eq(files.id, fileId),
            eq(files.status, FILE_STATUS.WAITING_CAPTION)
          )
        );
    }

    // 2. Remove session row from upload_sessions
    await db.delete(uploadSessions).where(eq(uploadSessions.user_id, userId));
  } catch (err) {
    console.error('Error during expireSessionDirect:', err);
  }
}

export async function getActiveSession(userId) {
  if (!userId) return null;
  const now = Math.floor(Date.now() / 1000);

  const sessions = await db.select()
    .from(uploadSessions)
    .where(eq(uploadSessions.user_id, userId))
    .limit(1);

  if (sessions.length === 0) return null;
  const session = sessions[0];

  // Lazy expiration: perform direct cleanup without recursive getActiveSession call
  if (now > session.session_expires_at) {
    await expireSessionDirect(userId, session.file_id);
    return null;
  }

  return session;
}

export async function createUploadSession({ userId, fileId, promptMessageId }) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + LIMITS.SESSION_TTL_SECONDS;

  const existing = await getActiveSession(userId);
  if (existing) {
    throw new BotAppError(
      ERROR_CODES.INVALID_STATE,
      'Active session exists.',
      '⚠️ شما یک آپلود در حال انجام دارید. لطفاً ابتدا آن را تکمیل کنید یا با دستور /cancel آن را لغو نمایید.'
    );
  }

  const session = {
    user_id: userId,
    file_id: fileId,
    step: SESSION_STEP.WAITING_CAPTION,
    session_version: 1,
    prompt_message_id: promptMessageId || null,
    created_at: now,
    updated_at: now,
    session_expires_at: expiresAt,
  };

  try {
    await db.insert(uploadSessions).values(session);
    return session;
  } catch (err) {
    // If unique constraint failed on user_id, concurrent request created session first
    throw new BotAppError(
      ERROR_CODES.INVALID_STATE,
      'Concurrent session creation detected.',
      '⚠️ شما یک آپلود در حال انجام دارید. لطفاً ابتدا آن را تکمیل کنید یا با دستور /cancel آن را لغو نمایید.',
      err
    );
  }
}

export async function transitionSessionStep({
  userId,
  currentStep,
  nextStep,
  promptMessageId = null,
}) {
  const now = Math.floor(Date.now() / 1000);
  const session = await getActiveSession(userId);

  if (!session) {
    throw new BotAppError(
      ERROR_CODES.NOT_FOUND,
      'No active upload session found.',
      '⚠️ نشستی برای این عملیات یافت نشد یا منقضی شده است. لطفاً فایل را مجدداً ارسال کنید.'
    );
  }

  if (session.step !== currentStep) {
    throw new BotAppError(
      ERROR_CODES.INVALID_STATE,
      `Step mismatch: expected ${currentStep}, found ${session.step}.`,
      '⚠️ مرحله این عملیات تغییر کرده یا منقضی شده است.'
    );
  }

  const newVersion = (session.session_version || 1) + 1;

  // Atomic update with version check
  const updateRes = await db.update(uploadSessions)
    .set({
      step: nextStep,
      session_version: newVersion,
      prompt_message_id: promptMessageId ?? session.prompt_message_id,
      updated_at: now,
    })
    .where(
      and(
        eq(uploadSessions.user_id, userId),
        eq(uploadSessions.session_version, session.session_version)
      )
    );

  // Strict optimistic locking check
  if (updateRes && typeof updateRes.rowsAffected === 'number' && updateRes.rowsAffected === 0) {
    throw new BotAppError(
      ERROR_CODES.SESSION_CONCURRENCY,
      `Optimistic lock failure: session version conflict for user ${userId}.`,
      '⚠️ این عملیات قبلاً تغییر یافته یا توسط درخواست دیگری پردازش شده است.'
    );
  }

  return { ...session, step: nextStep, session_version: newVersion };
}

export async function cancelSession(userId, reason = 'USER_CANCELLED') {
  if (!userId) return false;
  const now = Math.floor(Date.now() / 1000);

  // Directly query the session row without calling getActiveSession (prevents recursion)
  const sessions = await db.select()
    .from(uploadSessions)
    .where(eq(uploadSessions.user_id, userId))
    .limit(1);

  if (sessions.length > 0) {
    const session = sessions[0];

    // Mark associated draft file as CANCELLED
    if (session.file_id) {
      await db.update(files)
        .set({
          status: FILE_STATUS.CANCELLED,
          last_error_code: reason,
          updated_at: now,
        })
        .where(eq(files.id, session.file_id));
    }

    // Delete session from upload_sessions
    await db.delete(uploadSessions).where(eq(uploadSessions.user_id, userId));
    return true;
  }

  return false;
}

export async function completeSession(userId) {
  if (!userId) return;
  await db.delete(uploadSessions).where(eq(uploadSessions.user_id, userId));
}
