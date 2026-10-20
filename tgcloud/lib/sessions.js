/**
 * @file Upload Session State Machine
 * @description Manages upload sessions in SQLite with concurrency versioning and lazy expiration.
 */
import { db } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { uploadSessions, files } from '../schema.js';
import { SESSION_STEP, FILE_STATUS, LIMITS, ERROR_CODES } from './constants.js';
import { BotAppError } from './errors.js';

export async function getActiveSession(userId) {
  if (!userId) return null;
  const now = Math.floor(Date.now() / 1000);

  const sessions = await db.select()
    .from(uploadSessions)
    .where(eq(uploadSessions.user_id, userId))
    .limit(1);

  if (sessions.length === 0) return null;
  const session = sessions[0];

  // Lazy expiration of abandoned sessions
  if (now > session.session_expires_at) {
    await cancelSession(userId, 'SESSION_EXPIRED');
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

  await db.insert(uploadSessions).values(session);
  return session;
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
  await db.update(uploadSessions)
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

  return { ...session, step: nextStep, session_version: newVersion };
}

export async function cancelSession(userId, reason = 'USER_CANCELLED') {
  const session = await getActiveSession(userId);
  const now = Math.floor(Date.now() / 1000);

  if (session) {
    // Mark associated draft file as CANCELLED
    await db.update(files)
      .set({
        status: FILE_STATUS.CANCELLED,
        last_error_code: reason,
        updated_at: now,
      })
      .where(eq(files.id, session.file_id));

    // Delete session from upload_sessions
    await db.delete(uploadSessions).where(eq(uploadSessions.user_id, userId));
    return true;
  }

  return false;
}

export async function completeSession(userId) {
  await db.delete(uploadSessions).where(eq(uploadSessions.user_id, userId));
}
