/**
 * @file Authorization and Permissions
 * @description Role-based access control, ownership verification, and admin validation.
 */
import { getConfig } from './config.js';

export async function isSystemAdmin(telegramId) {
  if (!telegramId) return false;
  const ownerId = await getConfig('OWNER_TELEGRAM_ID');
  return String(telegramId) === String(ownerId);
}

export function canManageFile(file, userId, isOwner = false) {
  if (!file || !userId) return false;
  if (isOwner) return true;
  return Number(file.owner_user_id) === Number(userId) || Number(file.admin_user_id) === Number(userId);
}
