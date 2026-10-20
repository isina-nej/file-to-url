/**
 * @file Telegram Message and Media Parser
 * @description Extracts and validates Telegram media objects according to Bot API standards.
 */
import { MEDIA_TYPE, ERROR_CODES } from './constants.js';
import { BotAppError } from './errors.js';

export function parseIncomingMedia(message) {
  if (!message || typeof message !== 'object') {
    throw new BotAppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid message payload.');
  }

  // 1. Check for media group / album (not supported in MVP to avoid separate split uploads)
  if (message.media_group_id) {
    throw new BotAppError(
      ERROR_CODES.MEDIA_NOT_SUPPORTED,
      'Media groups are not supported.',
      '⚠️ ارسال آلبوم یا چند فایل همزمان پشتیبانی نمی‌شود. لطفاً فایل‌ها را به صورت تک‌تک ارسال کنید.'
    );
  }

  // 2. Reject unsupported media formats (stickers, video notes)
  if (message.sticker) {
    throw new BotAppError(
      ERROR_CODES.MEDIA_NOT_SUPPORTED,
      'Stickers are not supported.',
      '⚠️ استیکر به عنوان فایل قابل اشتراک‌گذاری پشتیبانی نمی‌شود. لطفاً یک فایل، عکس، ویدئو یا آهنگ ارسال کنید.'
    );
  }

  if (message.video_note) {
    throw new BotAppError(
      ERROR_CODES.MEDIA_NOT_SUPPORTED,
      'Video notes are not supported.',
      '⚠️ ویدئو مسیج (پیام ویدیویی دایره‌ای) پشتیبانی نمی‌شود. لطفاً ویدئوی استاندارد ارسال نمایید.'
    );
  }

  // 3. Check for protected content
  if (message.has_protected_content) {
    throw new BotAppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Protected content cannot be copied.',
      '⚠️ این فایل دارای محتوای حفاظت‌شده است و امکان فوروارد یا کپی کردن آن وجود ندارد.'
    );
  }

  // 4. Document
  if (message.document) {
    const doc = message.document;
    const fileName = doc.file_name || 'document';
    const extMatch = fileName.match(/\.([a-zA-Z0-9_-]+)$/);
    const fileExtension = extMatch ? extMatch[1].toLowerCase() : null;

    return {
      mediaType: MEDIA_TYPE.DOCUMENT,
      telegramFileId: doc.file_id,
      telegramFileUniqueId: doc.file_unique_id,
      fileName,
      fileExtension,
      mimeType: doc.mime_type || 'application/octet-stream',
      fileSizeBytes: doc.file_size || 0,
      width: null,
      height: null,
      durationSeconds: null,
      thumbnailFileId: doc.thumbnail?.file_id || null,
      originalCaption: message.caption || null,
      captionEntities: message.caption_entities || null,
      rawMedia: doc,
    };
  }

  // 5. Photo (Telegram sends an array sorted by size; pick the highest resolution)
  if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
    const bestPhoto = message.photo[message.photo.length - 1];
    return {
      mediaType: MEDIA_TYPE.PHOTO,
      telegramFileId: bestPhoto.file_id,
      telegramFileUniqueId: bestPhoto.file_unique_id,
      fileName: `photo_${bestPhoto.file_unique_id}.jpg`,
      fileExtension: 'jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: bestPhoto.file_size || 0,
      width: bestPhoto.width || null,
      height: bestPhoto.height || null,
      durationSeconds: null,
      thumbnailFileId: null,
      originalCaption: message.caption || null,
      captionEntities: message.caption_entities || null,
      rawMedia: bestPhoto,
    };
  }

  // 6. Video
  if (message.video) {
    const vid = message.video;
    const fileName = vid.file_name || `video_${vid.file_unique_id}.mp4`;
    const extMatch = fileName.match(/\.([a-zA-Z0-9_-]+)$/);

    return {
      mediaType: MEDIA_TYPE.VIDEO,
      telegramFileId: vid.file_id,
      telegramFileUniqueId: vid.file_unique_id,
      fileName,
      fileExtension: extMatch ? extMatch[1].toLowerCase() : 'mp4',
      mimeType: vid.mime_type || 'video/mp4',
      fileSizeBytes: vid.file_size || 0,
      width: vid.width || null,
      height: vid.height || null,
      durationSeconds: vid.duration || null,
      thumbnailFileId: vid.thumbnail?.file_id || null,
      originalCaption: message.caption || null,
      captionEntities: message.caption_entities || null,
      rawMedia: vid,
    };
  }

  // 7. Audio
  if (message.audio) {
    const aud = message.audio;
    const fileName = aud.file_name || `${aud.performer ? aud.performer + ' - ' : ''}${aud.title || 'audio'}.mp3`;
    const extMatch = fileName.match(/\.([a-zA-Z0-9_-]+)$/);

    return {
      mediaType: MEDIA_TYPE.AUDIO,
      telegramFileId: aud.file_id,
      telegramFileUniqueId: aud.file_unique_id,
      fileName,
      fileExtension: extMatch ? extMatch[1].toLowerCase() : 'mp3',
      mimeType: aud.mime_type || 'audio/mpeg',
      fileSizeBytes: aud.file_size || 0,
      width: null,
      height: null,
      durationSeconds: aud.duration || null,
      thumbnailFileId: aud.thumbnail?.file_id || null,
      originalCaption: message.caption || null,
      captionEntities: message.caption_entities || null,
      rawMedia: aud,
    };
  }

  // 8. Animation (GIF)
  if (message.animation) {
    const anim = message.animation;
    return {
      mediaType: MEDIA_TYPE.ANIMATION,
      telegramFileId: anim.file_id,
      telegramFileUniqueId: anim.file_unique_id,
      fileName: anim.file_name || `animation_${anim.file_unique_id}.mp4`,
      fileExtension: 'mp4',
      mimeType: anim.mime_type || 'video/mp4',
      fileSizeBytes: anim.file_size || 0,
      width: anim.width || null,
      height: anim.height || null,
      durationSeconds: anim.duration || null,
      thumbnailFileId: anim.thumbnail?.file_id || null,
      originalCaption: message.caption || null,
      captionEntities: message.caption_entities || null,
      rawMedia: anim,
    };
  }

  // 9. Voice
  if (message.voice) {
    const v = message.voice;
    return {
      mediaType: MEDIA_TYPE.VOICE,
      telegramFileId: v.file_id,
      telegramFileUniqueId: v.file_unique_id,
      fileName: `voice_${v.file_unique_id}.ogg`,
      fileExtension: 'ogg',
      mimeType: v.mime_type || 'audio/ogg',
      fileSizeBytes: v.file_size || 0,
      width: null,
      height: null,
      durationSeconds: v.duration || null,
      thumbnailFileId: null,
      originalCaption: message.caption || null,
      captionEntities: message.caption_entities || null,
      rawMedia: v,
    };
  }

  // Not a media message
  return null;
}
