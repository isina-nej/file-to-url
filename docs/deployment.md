# راهنمای گام‌به‌گام استقرار (Deployment Guide)

این راهنما مراحل استقرار پروژه **FileLink Bot** بر روی **Telegram Serverless** را با استفاده از ابزار رسمی CLI پلتفرم تشریح می‌کند.

---

## ۱. پیش‌نیازها

1. ساخت ربات تلگرام با **@BotFather** و دریافت توکن ربات.
2. فعال‌سازی قابلیت Telegram Serverless برای ربات در BotFather (دستور `/serverless` یا از طریق منوی تنظیمات ربات).
3. دریافت **CLI Access Token** از تلگرام.
4. ساخت یک کانال خصوصی در تلگرام جهت آرشیو فایل‌ها و اضافه کردن ربات به عنوان ادمین با مجوز ارسال پیام (`Post Messages`).

---

## ۲. راه‌اندازی و ورود با CLI

در ترمینال پروژه دستور زیر را اجرا کنید:

```bash
npx tgcloud login
```

در این مرحله Access Token مخصوص سرورلس را وارد نمایید.

وضعیت اتصال را بررسی کنید:

```bash
npx tgcloud status
```

---

## ۳. تنظیم متغیرهای اولیه

تنظیم شناسه کانال ذخیره‌سازی و شناسه عددی ادمین:

```bash
# تنظیم شناسه کانال خصوصی آرشیو (مثال: -1001234567890)
npx tgcloud db query "INSERT INTO app_settings (key, value, updated_at) VALUES ('STORAGE_CHANNEL_ID', '-1001234567890', 1700000000) ON CONFLICT(key) DO UPDATE SET value=excluded.value;"

# تنظیم شناسه تلگرام مدیر اصلی (برای مدیریت دسترسی‌ها)
npx tgcloud db query "INSERT INTO app_settings (key, value, updated_at) VALUES ('OWNER_TELEGRAM_ID', '12345678', 1700000000) ON CONFLICT(key) DO UPDATE SET value=excluded.value;"

# تنظیم نام کاربری ربات (بدون @)
npx tgcloud db query "INSERT INTO app_settings (key, value, updated_at) VALUES ('BOT_USERNAME', 'FileLinkBot', 1700000000) ON CONFLICT(key) DO UPDATE SET value=excluded.value;"
```

---

## ۴. اجرای مایگریشن پایگاه‌داده

بررسی تغییرات دیتابیس بدون اعمال:

```bash
npx tgcloud migrate --dry-run
```

اعمال اسکیمای پایگاه‌داده:

```bash
npx tgcloud migrate
```

---

## ۵. استقرار کدها (Push)

بررسی تفاوت‌های کد محلی با فضای ابری تلگرام:

```bash
npx tgcloud diff
```

ارسال و استقرار نهایی هندلرها و لایبری‌ها:

```bash
npx tgcloud push
```

---

## ۶. تست و اعتبارسنجی در محیط ابر

تست سریع اجرای هندلر پیام به صورت آزمایشی در کلاود:

```bash
npx tgcloud run handlers/message '{ "chat": { "id": 12345 }, "from": { "id": 12345, "first_name": "Admin" }, "text": "/start" }'
```

مشاهده لاگ‌های زنده ربات در سرورلس:

```bash
npx tgcloud logs --follow
```

---

## ۷. فرآیند بازگشت به نسخه قبل (Rollback)

در صورت نیاز به بازگردانی تغییرات:

```bash
npx tgcloud rollback
```
یا با مشخص کردن شناسه نسخه:
```bash
npx tgcloud deploy --release <RELEASE_ID>
```
