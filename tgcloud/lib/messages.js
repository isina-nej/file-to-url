/**
 * @file Persian Messages and Templates
 * @description User-facing Persian texts, HTML sanitizers, and formatting helpers.
 */

export function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return 'نامشخص';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export function formatPersianDate(timestampSec) {
  if (!timestampSec) return 'نامشخص';
  const date = new Date(timestampSec * 1000);
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Tehran',
    }).format(date);
  } catch (err) {
    return date.toISOString().replace('T', ' ').substring(0, 16);
  }
}

export function getWelcomeMessage(firstName) {
  const safeName = escapeHtml(firstName || 'کاربر گرامی');
  return `سلام <b>${safeName}</b>، به <b>FileLink Bot</b> خوش آمدید! 👋

این ربات به شما امکان می‌دهد هر فایلی را در تلگرام به صورت امن ذخیره کرده و یک <b>لینک اختصاصی مستقیم</b> برای اشتراک‌گذاری با دیگران دریافت کنید.

✨ <b>ویژگی‌ها:</b>
• پشتیبانی از فایل، عکس، ویدئو، آهنگ، ویس و گیف
• بدون مصرف ترافیک دانلود/آپلود روی سرور (کپی مستقیم در ابر تلگرام)
• قابلیت تنظیم کپشن دلخواه
• امکان تعیین تاریخ انقضا (از ۱ تا ۳۶۵۰ روز یا دائمی)
• گزارش آمار دریافت و مدیریت فعال/غیرفعال‌سازی لینک‌ها

برای شروع کافیست <b>همین الان هر فایلی را برای من بفرستید</b>! 📥`;
}

export function getHelpMessage() {
  return `📖 <b>راهنمای استفاده از FileLink Bot</b>

۱. <b>ارسال فایل:</b>
هر فایلی (سند، تصویر، ویدئو، موزیک، ویس، گیف) را به ربات فوروارد یا ارسال کنید.

۲. <b>تنظیم کپشن:</b>
می‌توانید متنی به عنوان کپشن ارسال کنید یا دکمه «بدون کپشن» را بزنید.

۳. <b>تعیین مدت اعتبار (انقضا):</b>
تعداد روزهای مجاز برای دریافت فایل (بین ۱ تا ۳۶۵۰ روز) را ارسال کنید یا گزینه «دائمی» را انتخاب نمایید.

۴. <b>دریافت لینک:</b>
یک لینک اختصاصی تلگرامی مانند <code>t.me/Bot?start=f_...</code> دریافت می‌کنید که می‌توانید برای هر شخصی بفرستید. هر کاربری که روی لینک بزند، فایل بلافاصله در پیوی او ارسال خواهد شد.

دستورات موجود:
/start - شروع و راهنمای اولیه
/myfiles - مشاهده و مدیریت فایل‌های من
/stats - آمار فایل‌ها و دانلودها
/cancel - لغو عملیات یا آپلود در جریان
/privacy - شرایط حریم خصوصی و امنیت`;
}

export function getPrivacyMessage() {
  return `🔒 <b>سیاست حریم خصوصی و شرایط سرویس</b>

• <b>نحوه ذخیره‌سازی:</b>
فایل‌های ارسالی با استفاده از مکانیزم رسمی Telegram Bot API به یک کانال خصوصی تحت مدیریت ربات کپی می‌شوند.

• <b>دسترسی به فایل‌ها:</b>
لینک‌های اختصاصی تولید شده Bearer Token هستند؛ یعنی هر شخصی که لینک معتبر را داشته باشد، امکان دریافت فایل را در چت شخصی خود دارد.

• <b>غیرفعال‌سازی:</b>
صاحب فایل هر زمان می‌تواند با مراجعه به بخش «فایل‌های من»، لینک اختصاصی را غیرفعال کند تا دیگران نتوانند فایل را دریافت کنند.

• <b>محتوای حساس و ممنوعه:</b>
ارسال فایل‌های مخرب، بدافزار و موارد ناقض قوانین تلگرام ممنوع است و بر اساس گزارش‌ها توسط ادمین مسدود خواهند شد.`;
}

export function getCaptionPromptMessage() {
  return `📝 <b>مرحله ۱ از ۲: تنظیم کپشن</b>

لطفاً کپشن فایل خود را ارسال کنید.
می‌توانید توضیحی برای این فایل بنویسید یا گزینه <b>بدون کپشن</b> را انتخاب کنید:`;
}

export function getExpirationPromptMessage() {
  return `⏳ <b>مرحله ۲ از ۲: مدت اعتبار لینک</b>

فایل شما چند روز قابل دریافت باشد؟
عددی بین <b>۱ تا ۳۶۵۰</b> وارد کنید یا یکی از گزینه‌های آماده زیر را انتخاب کنید:`;
}

export function getUploadSuccessMessage({
  fileName,
  fileSize,
  caption,
  expirationText,
  shareLink,
}) {
  const safeName = escapeHtml(fileName || 'فایل بدون نام');
  const safeSize = escapeHtml(formatBytes(fileSize));
  const safeCaption = caption ? escapeHtml(caption) : '<i>بدون کپشن</i>';

  let msg = `✅ <b>فایل شما با موفقیت ذخیره شد!</b>\n\n`;
  msg += `📄 <b>نام فایل:</b> <code>${safeName}</code>\n`;
  msg += `💾 <b>حجم:</b> ${safeSize}\n`;
  msg += `📝 <b>کپشن:</b> ${safeCaption}\n`;
  msg += `⏳ <b>اعتبار:</b> ${escapeHtml(expirationText)}\n`;
  msg += `\n🔗 <b>لینک دریافت مستقیم:</b>\n<code>${escapeHtml(shareLink)}</code>\n\n`;
  msg += `این لینک را برای دوستان یا کانال‌های خود ارسال کنید تا با زدن دکمه Start، فایل را در پیوی دریافت کنند.`;
  return msg;
}

export function getFileDetailMessage(file, shareLink) {
  const safeName = escapeHtml(file.file_name || `فایل #${file.id}`);
  const statusLabel =
    file.status === 'ACTIVE'
      ? '🟢 فعال'
      : file.status === 'EXPIRED'
      ? '⏳ منقضی شده'
      : file.status === 'DISABLED'
      ? '🔴 غیرفعال شده توسط صاحب فایل'
      : file.status;

  let msg = `📋 <b>جزئیات فایل #${file.id}</b>\n\n`;
  msg += `📄 <b>نام:</b> <code>${safeName}</code>\n`;
  msg += `💾 <b>حجم:</b> ${escapeHtml(formatBytes(file.file_size_bytes))}\n`;
  msg += `📊 <b>وضعیت:</b> ${statusLabel}\n`;
  msg += `📥 <b>تعداد دانلود:</b> ${file.download_count || 0} بار\n`;
  msg += `📅 <b>تاریخ ثبت:</b> ${formatPersianDate(file.created_at)}\n`;

  if (file.expires_at) {
    msg += `⏳ <b>تاریخ انقضا:</b> ${formatPersianDate(file.expires_at)}\n`;
  } else {
    msg += `♾ <b>تاریخ انقضا:</b> بدون انقضا (دائمی)\n`;
  }

  if (file.caption) {
    msg += `📝 <b>کپشن:</b> ${escapeHtml(file.caption)}\n`;
  }

  if (file.status === 'ACTIVE') {
    msg += `\n🔗 <b>لینک اشتراک:</b>\n<code>${escapeHtml(shareLink)}</code>\n`;
  }

  return msg;
}

export function getUserStatsMessage({ totalFiles, activeFiles, expiredFiles, totalDownloads, totalBytes }) {
  return `📊 <b>آمار فایل‌های شما</b>

📁 کل فایل‌های شما: <b>${totalFiles}</b>
🟢 فایل‌های فعال: <b>${activeFiles}</b>
⏳ فایل‌های منقضی: <b>${expiredFiles}</b>
📥 مجموع دفعات دانلود فایل‌های شما: <b>${totalDownloads}</b>
💾 مجموع حجم فایل‌های شما: <b>${formatBytes(totalBytes)}</b>`;
}

export function getSystemStatsMessage({ totalFiles, activeFiles, expiredFiles, totalDownloads, totalBytes, totalUsers }) {
  return `📊 <b>آمار کل سامانه (مخصوص مدیریت)</b>

👥 کل کاربران: <b>${totalUsers}</b>
📁 کل فایل‌های ثبت‌شده: <b>${totalFiles}</b>
🟢 فایل‌های فعال: <b>${activeFiles}</b>
⏳ فایل‌های منقضی: <b>${expiredFiles}</b>
📥 مجموع کل دانلودهای موفق: <b>${totalDownloads}</b>
💾 مجموع حجم آرشیو: <b>${formatBytes(totalBytes)}</b>`;
}

export function getStatsMessage(stats) {
  return getUserStatsMessage(stats);
}

