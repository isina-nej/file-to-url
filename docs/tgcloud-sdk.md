# مستندات و رفرنس SDK تلگرام سرورلس (`sdk` و `sdk/db`)

این سند مأخذ رسمی توابع، کلاس‌ها و نحوه ایمپورت ماژول‌های بومی Telegram Serverless در پروژه است.

## ۱. نحوه Import رسمی در Runtime

```javascript
import { api, db, BotApiError } from 'sdk';
import { sqliteTable, text, integer, eq, and, or, sql, desc } from 'sdk/db';
```

## ۲. متدهای شیء `api` (Telegram Bot API)

پلتفرم Telegram Serverless کلاینت داخلی Bot API را به شکل `api` فراهم می‌کند. تمام فراخوانی‌ها `Promise` هستند و باید `await` شوند:

- `api.sendMessage({ chat_id, text, parse_mode, reply_markup })`
- `api.copyMessage({ chat_id, from_chat_id, message_id, caption })`
  - خروجی: شیء `MessageId` شامل `{ message_id: number }`.
- `api.editMessageText({ chat_id, message_id, text, parse_mode, reply_markup })`
- `api.answerCallbackQuery({ callback_query_id, text, show_alert })`
- متدهای ارسال رسانه: `sendDocument`, `sendPhoto`, `sendVideo`, `sendAudio`, `sendAnimation`, `sendVoice`

## ۳. پایگاه‌داده و کوئری‌بیلدر `db`

مشابه Drizzle ORM برای دیتابیس SQLite داخلی:

- **تعریف جدول در `schema.js`:**
  ```javascript
  import { sqliteTable, text, integer } from 'sdk/db';

  export const files = sqliteTable('files', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    share_token: text('share_token').unique(),
    owner_user_id: integer('owner_user_id').notNull(),
    status: text('status').notNull(),
  });
  ```
- **کوئری Select:**
  ```javascript
  const rows = await db.select().from(files).where(eq(files.id, 123)).limit(1);
  ```
- **کوئری Insert:**
  ```javascript
  const res = await db.insert(files).values({ ... });
  ```
- **کوئری Update:**
  ```javascript
  await db.update(files).set({ status: 'ACTIVE' }).where(eq(files.id, 123));
  ```
- **کوئری Delete:**
  ```javascript
  await db.delete(uploadSessions).where(eq(uploadSessions.user_id, userId));
  ```

## ۴. مدیریت خطای `BotApiError`

در صورت بروز خطای سمت Bot API تلگرام (مانند بلاک بودن ربات، عدم دسترسی به کانال، خطای ۴۲۹)، آبجکت خطای پرتاب‌شده از جنس `BotApiError` است که فیلدهای `code` و `description` را دارد:

```javascript
try {
  await api.copyMessage({ ... });
} catch (err) {
  if (err instanceof BotApiError) {
    console.error(`Telegram Bot API Error ${err.code}: ${err.description}`);
  }
}
```
