# مستندات پایگاه‌داده FileLink Bot (Telegram Serverless SQLite)

پایگاه‌داده این پروژه بر روی دیتابیس بومی SQLite تلگرام سرورلس با سینتکس رسمی `sdk/db` طراحی شده است.

## جداول سیستم

### ۱. جدول `users`
ثبت اطلاعات کاربران و ممیزی فعالیت‌ها:
- `telegram_id` (INTEGER, Primary Key): شناسه یکتای عددی کاربر در تلگرام
- `username` (TEXT): نام کاربری تلگرام (بدون @)
- `first_name` (TEXT): نام کوچک
- `last_name` (TEXT): نام خانوادگی
- `language_code` (TEXT): کد زبان کلاینت تلگرام
- `is_bot` (INTEGER): صفر یا یک
- `is_blocked` (INTEGER): وضعیت بلاک
- `created_at` (INTEGER): زمان اولین تعامل (ثانیه از مبدأ زمان یونیکس)
- `updated_at` (INTEGER): زمان آخرین به‌روزرسانی
- `last_seen_at` (INTEGER): زمان آخرین پیام

### ۲. جدول `files`
شناسنامه و متادیتای تمام فایل‌های آرشیو و اشتراک‌گذاری:
- `id` (INTEGER, Primary Key AutoIncrement)
- `share_token` (TEXT, UNIQUE): توکن امنیتی دیپ‌لینک (مانند `f_7xK...`)
- `owner_user_id` (INTEGER): شناسه کاربر آپلودکننده
- `admin_user_id` (INTEGER): شناسه مدیر فایل (به‌صورت پیش‌فرض برابر صاحب فایل)
- `status` (TEXT): وضعیت (`DRAFT`, `WAITING_CAPTION`, `WAITING_EXPIRY`, `ARCHIVING`, `ACTIVE`, `ARCHIVE_FAILED`, `DISABLED`, `EXPIRED`, `CANCELLED`)
- `original_caption` (TEXT): کپشن اولیه پیام فرستاده‌شده
- `caption` (TEXT): کپشن نهایی تعیین‌شده توسط کاربر
- `caption_entities_json` (TEXT): انتیتی‌های قالب‌بندی کپشن
- `source_chat_id` (INTEGER): چت منبع آپلود
- `source_message_id` (INTEGER): شناسه پیام اولیه
- `source_media_group_id` (TEXT): شناسه گروه رسانه (جهت رد کردن آلبوم‌ها)
- `storage_chat_id` (INTEGER): شناسه کانال خصوصی آرشیو
- `storage_message_id` (INTEGER): شناسه پیام فایل در کانال آرشیو
- `telegram_file_id` (TEXT): شناسه فایل تلگرام (برای مسیر جایگزین تحویل)
- `telegram_file_unique_id` (TEXT): شناسه یکتای فایل تلگرام
- `media_type` (TEXT): نوع رسانه (`document`, `photo`, `video`, `audio`, `animation`, `voice`)
- `file_name` (TEXT): نام فایل
- `file_extension` (TEXT): پسوند فایل (مانند pdf, mp4, pdb, fasta)
- `mime_type` (TEXT): نوع MIME
- `file_size_bytes` (INTEGER): حجم به بایت
- `width` / `height` / `duration_seconds` / `thumbnail_file_id`: مشخصات ابعادی و زمانی رسانه
- `media_metadata_json` (TEXT): متادیتای تکنیکال و شناسایی علمی (PDB, FASTA, SDF, PMID)
- `telegram_metadata_json` (TEXT): اطلاعات متادیتا فوروارد و زمینه تلگرام
- `received_at` / `created_at` / `archived_at` / `published_at` / `updated_at`: برچسب‌های زمانی یونیکس
- `expires_at` (INTEGER): زمان دقیق پایان اعتبار لینک (null = بدون انقضا)
- `disabled_at` (INTEGER): زمان غیرفعال‌سازی دستی توسط صاحب فایل
- `last_download_at` (INTEGER): زمان آخرین دانلود موفق
- `expiration_days` (INTEGER): مدت انقضای انتخابی (۱ تا ۳۶۵۰ روز یا null)
- `download_count` (INTEGER): شمارنده دفعات دانلود موفق
- `delivery_error_count` (INTEGER): شمارنده خطاهای تحویل
- `last_error_code` (TEXT): آخرین کد خطای ثبت‌شده

### ۳. جدول `upload_sessions`
مدیریت ماشین وضعیت نشست‌های آپلود کاربر:
- `user_id` (INTEGER, Primary Key): هر کاربر حداکثر یک نشست فعال در هر لحظه دارد.
- `file_id` (INTEGER): ارجاع به فایل در حال ساخت
- `step` (TEXT): مرحله فعلی (`WAITING_CAPTION`, `WAITING_EXPIRY`, `ARCHIVING`)
- `session_version` (INTEGER): شماره نسخه برای کنترل همزمانی
- `prompt_message_id` (INTEGER): شناسه پیام درخواست ارسالی برای ویرایش
- `created_at`, `updated_at`: زمان‌های ساخت و تغییر
- `session_expires_at`: زمان انقضای تنبل نشست (یک ساعت)

### ۴. جدول `file_deliveries`
گزارش و ممیزی تحویل فایل‌ها به کاربران:
- `id` (INTEGER, Primary Key AutoIncrement)
- `file_id` (INTEGER): شناسه فایل تحویل‌شده
- `receiver_user_id` (INTEGER): دریافت‌کننده
- `request_key` (TEXT): کلید درخواست
- `requested_at` / `delivered_at`: زمان‌های درخواست و تحویل
- `sent_message_id`: شناسه پیام ارسال‌شده در پیوی دریافت‌کننده
- `status`: `SUCCESS` یا `FAILED`
- `error_code`: کد خطا در صورت عدم موفقیت

### ۵. جدول `processed_events`
تضمین قابلیت تکرارناپذیری (Idempotency) و محدودیت نرخ (Rate Limiting):
- `event_key` (TEXT, Primary Key)
- `event_type` (TEXT): نوع رویداد (مانند `MESSAGE`, `CALLBACK_QUERY`, `RATE_LIMIT`)
- `processed_at` (INTEGER)
- `result_reference` (TEXT)

### ۶. جدول `app_settings`
تنظیمات داینامیک قابل بازخوانی در زمان اجرا بدون `process.env`:
- `key` (TEXT, Primary Key): نام متغیر (مانند `STORAGE_CHANNEL_ID`, `OWNER_TELEGRAM_ID`)
- `value` (TEXT): مقدار متغیر
- `updated_at` (INTEGER)

### ۷. جدول `abuse_reports`
گزارش‌های سوءاستفاده از فایل‌ها برای بازبینی ادمین:
- `id` (INTEGER, Primary Key AutoIncrement)
- `file_id` (INTEGER)
- `reporter_user_id` (INTEGER)
- `reason` (TEXT)
- `status` (TEXT)
- `created_at` (INTEGER)
