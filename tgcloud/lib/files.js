/**
 * @file Files Management and Queries
 * @description Creation, pagination, status toggling, and statistical queries on SQLite files table.
 */
import { db } from 'sdk';
import { eq, and, sql, desc } from 'sdk/db';
import { files } from '../schema.js';
import { FILE_STATUS, ERROR_CODES } from './constants.js';
import { generateUniqueShareToken } from './links.js';
import { extractMediaMetadata, extractTelegramMetadata } from './metadata.js';
import { isFileExpired } from './expiration.js';
import { canManageFile } from './permissions.js';
import { BotAppError } from './errors.js';

export async function createFileDraft({
  ownerUserId,
  parsedMedia,
  sourceChatId,
  sourceMessageId,
  rawMessage,
}) {
  const now = Math.floor(Date.now() / 1000);
  const shareToken = await generateUniqueShareToken();
  const { mediaMetadataJson, scienceBadge } = extractMediaMetadata(parsedMedia);
  const telegramMetadataJson = extractTelegramMetadata(rawMessage);

  const newFile = {
    share_token: shareToken,
    owner_user_id: ownerUserId,
    admin_user_id: ownerUserId,
    status: FILE_STATUS.WAITING_CAPTION,
    original_caption: parsedMedia.originalCaption || null,
    caption: null,
    caption_entities_json: parsedMedia.captionEntities ? JSON.stringify(parsedMedia.captionEntities) : null,
    source_chat_id: sourceChatId,
    source_message_id: sourceMessageId,
    source_media_group_id: null,
    storage_chat_id: null,
    storage_message_id: null,
    telegram_file_id: parsedMedia.telegramFileId,
    telegram_file_unique_id: parsedMedia.telegramFileUniqueId,
    media_type: parsedMedia.mediaType,
    file_name: parsedMedia.fileName,
    file_extension: parsedMedia.fileExtension,
    mime_type: parsedMedia.mimeType,
    file_size_bytes: parsedMedia.fileSizeBytes,
    width: parsedMedia.width,
    height: parsedMedia.height,
    duration_seconds: parsedMedia.durationSeconds,
    thumbnail_file_id: parsedMedia.thumbnailFileId,
    media_metadata_json: mediaMetadataJson,
    telegram_metadata_json: telegramMetadataJson,
    received_at: now,
    created_at: now,
    archived_at: null,
    published_at: null,
    updated_at: now,
    expires_at: null,
    disabled_at: null,
    last_download_at: null,
    expiration_days: null,
    download_count: 0,
    delivery_error_count: 0,
    last_error_code: null,
  };

  const insertResult = await db.insert(files).values(newFile);
  const insertedId = insertResult.lastInsertRowid ?? insertResult[0]?.id;

  return {
    ...newFile,
    id: insertedId,
    scienceBadge,
  };
}

export async function getFileById(fileId) {
  const rows = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  return rows.length > 0 ? rows[0] : null;
}

export async function getUserFiles(userId, page = 1, pageSize = 5) {
  const offset = (page - 1) * pageSize;

  const totalRows = await db.select()
    .from(files)
    .where(
      and(
        eq(files.owner_user_id, userId),
        sql`${files.status} IN ('ACTIVE', 'DISABLED', 'EXPIRED')`
      )
    );

  const totalFiles = totalRows.length;
  const totalPages = Math.ceil(totalFiles / pageSize) || 1;

  const userFiles = await db.select()
    .from(files)
    .where(
      and(
        eq(files.owner_user_id, userId),
        sql`${files.status} IN ('ACTIVE', 'DISABLED', 'EXPIRED')`
      )
    )
    .orderBy(desc(files.created_at))
    .limit(pageSize)
    .offset(offset);

  return {
    files: userFiles,
    totalFiles,
    totalPages,
    currentPage: page,
  };
}

export async function toggleFileStatus(fileId, userId, isOwner = false) {
  const file = await getFileById(fileId);
  if (!file) {
    throw new BotAppError(ERROR_CODES.NOT_FOUND, 'File not found.');
  }

  if (!canManageFile(file, userId, isOwner)) {
    throw new BotAppError(ERROR_CODES.UNAUTHORIZED, 'Unauthorized file management.');
  }

  const now = Math.floor(Date.now() / 1000);

  // If ACTIVE -> Disable
  if (file.status === FILE_STATUS.ACTIVE) {
    await db.update(files)
      .set({
        status: FILE_STATUS.DISABLED,
        disabled_at: now,
        updated_at: now,
      })
      .where(eq(files.id, fileId));

    return { success: true, newStatus: FILE_STATUS.DISABLED };
  }

  // If DISABLED -> Check expiration before reactivating!
  if (file.status === FILE_STATUS.DISABLED) {
    if (isFileExpired(file, now)) {
      await db.update(files)
        .set({
          status: FILE_STATUS.EXPIRED,
          updated_at: now,
        })
        .where(eq(files.id, fileId));

      throw new BotAppError(
        ERROR_CODES.EXPIRED,
        'File is expired and cannot be reactivated.',
        '⏳ مهلت انقضای این فایل به پایان رسیده است و امکان فعال‌سازی مجدد آن وجود ندارد.'
      );
    }

    await db.update(files)
      .set({
        status: FILE_STATUS.ACTIVE,
        disabled_at: null,
        updated_at: now,
      })
      .where(eq(files.id, fileId));

    return { success: true, newStatus: FILE_STATUS.ACTIVE };
  }

  throw new BotAppError(
    ERROR_CODES.INVALID_STATE,
    `Cannot toggle file in status: ${file.status}`,
    '⚠️ امکان تغییر وضعیت این فایل وجود ندارد.'
  );
}

export async function getSystemStats() {
  const allFiles = await db.select().from(files);
  const now = Math.floor(Date.now() / 1000);

  let activeFiles = 0;
  let expiredFiles = 0;
  let totalDownloads = 0;
  let totalBytes = 0;

  for (const f of allFiles) {
    if (f.status === FILE_STATUS.ACTIVE) {
      if (isFileExpired(f, now)) {
        expiredFiles++;
      } else {
        activeFiles++;
      }
    } else if (f.status === FILE_STATUS.EXPIRED) {
      expiredFiles++;
    }
    totalDownloads += (f.download_count || 0);
    totalBytes += (f.file_size_bytes || 0);
  }

  return {
    totalFiles: allFiles.length,
    activeFiles,
    expiredFiles,
    totalDownloads,
    totalBytes,
  };
}
