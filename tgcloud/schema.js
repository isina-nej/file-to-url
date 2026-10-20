/**
 * @file Telegram Serverless Native Database Schema
 * @description SQLite schema DSL for @tgcloud/cli runtime.
 * Strict rules:
 * - Pure ES Module
 * - No foreign keys (unsupported in Telegram Serverless runtime)
 * - All timestamps are Unix Epoch in seconds (integer)
 */
import { sqliteTable, text, integer } from 'sdk/db';

export const users = sqliteTable('users', {
  telegram_id: integer('telegram_id').primaryKey(),
  username: text('username'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  language_code: text('language_code'),
  is_bot: integer('is_bot').default(0),
  is_blocked: integer('is_blocked').default(0),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  last_seen_at: integer('last_seen_at').notNull(),
});

export const files = sqliteTable('files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  share_token: text('share_token').unique(),
  owner_user_id: integer('owner_user_id').notNull(),
  admin_user_id: integer('admin_user_id').notNull(),
  status: text('status').notNull(), // DRAFT, WAITING_CAPTION, WAITING_EXPIRY, ARCHIVING, ACTIVE, ARCHIVE_FAILED, DISABLED, EXPIRED, CANCELLED

  // Captions
  original_caption: text('original_caption'),
  caption: text('caption'),
  caption_entities_json: text('caption_entities_json'),

  // Source message info
  source_chat_id: integer('source_chat_id').notNull(),
  source_message_id: integer('source_message_id').notNull(),
  source_media_group_id: text('source_media_group_id'),

  // Archive channel info
  storage_chat_id: integer('storage_chat_id'),
  storage_message_id: integer('storage_message_id'),
  telegram_file_id: text('telegram_file_id'),
  telegram_file_unique_id: text('telegram_file_unique_id'),

  // Technical & media metadata
  media_type: text('media_type').notNull(), // document, photo, video, audio, animation, voice
  file_name: text('file_name'),
  file_extension: text('file_extension'),
  mime_type: text('mime_type'),
  file_size_bytes: integer('file_size_bytes'),
  width: integer('width'),
  height: integer('height'),
  duration_seconds: integer('duration_seconds'),
  thumbnail_file_id: text('thumbnail_file_id'),
  media_metadata_json: text('media_metadata_json'),
  telegram_metadata_json: text('telegram_metadata_json'),

  // Timestamps
  received_at: integer('received_at').notNull(),
  created_at: integer('created_at').notNull(),
  archived_at: integer('archived_at'),
  published_at: integer('published_at'),
  updated_at: integer('updated_at').notNull(),
  expires_at: integer('expires_at'),
  disabled_at: integer('disabled_at'),
  last_download_at: integer('last_download_at'),

  // Expiration & telemetry
  expiration_days: integer('expiration_days'),
  download_count: integer('download_count').default(0),
  delivery_error_count: integer('delivery_error_count').default(0),
  last_error_code: text('last_error_code'),
});

export const uploadSessions = sqliteTable('upload_sessions', {
  user_id: integer('user_id').primaryKey(),
  file_id: integer('file_id').notNull(),
  step: text('step').notNull(), // WAITING_CAPTION, WAITING_EXPIRY, ARCHIVING
  session_version: integer('session_version').default(1),
  prompt_message_id: integer('prompt_message_id'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  session_expires_at: integer('session_expires_at').notNull(),
});

export const fileDeliveries = sqliteTable('file_deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  file_id: integer('file_id').notNull(),
  receiver_user_id: integer('receiver_user_id').notNull(),
  request_key: text('request_key'),
  requested_at: integer('requested_at').notNull(),
  delivered_at: integer('delivered_at'),
  sent_message_id: integer('sent_message_id'),
  status: text('status').notNull(), // SUCCESS, FAILED
  error_code: text('error_code'),
});

export const processedEvents = sqliteTable('processed_events', {
  event_key: text('event_key').primaryKey(),
  event_type: text('event_type').notNull(),
  processed_at: integer('processed_at').notNull(),
  result_reference: text('result_reference'),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: integer('updated_at').notNull(),
});

export const abuseReports = sqliteTable('abuse_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  file_id: integer('file_id').notNull(),
  reporter_user_id: integer('reporter_user_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status').default('PENDING'),
  created_at: integer('created_at').notNull(),
});
