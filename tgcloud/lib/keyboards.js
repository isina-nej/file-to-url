/**
 * @file Telegram Keyboards (Inline & Reply)
 * @description Standardized Persian keyboards with valid Bot API callback payloads.
 */

export function getMainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '📤 ارسال فایل جدید' }, { text: '📁 فایل‌های من' }],
      [{ text: '📊 آمار من' }, { text: 'ℹ️ راهنما' }],
      [{ text: '🔒 حریم خصوصی' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function getCaptionKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '⏩ بدون کپشن', callback_data: 'caption_skip' }],
      [{ text: '❌ لغو عملیات', callback_data: 'upload_cancel' }],
    ],
  };
}

export function getExpirationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '۱ روز', callback_data: 'exp_1' },
        { text: '۷ روز', callback_data: 'exp_7' },
        { text: '۳۰ روز', callback_data: 'exp_30' },
      ],
      [
        { text: '۳۶۵ روز (۱ سال)', callback_data: 'exp_365' },
        { text: '♾ بدون انقضا (دائمی)', callback_data: 'exp_never' },
      ],
      [{ text: '❌ لغو عملیات', callback_data: 'upload_cancel' }],
    ],
  };
}

export function getUploadSuccessKeyboard(shareLink) {
  return {
    inline_keyboard: [
      [
        {
          text: '🚀 اشتراک‌گذاری در تلگرام',
          url: `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('دریافت فایل از طریق ربات FileLink:')}`,
        },
      ],
      [
        { text: '📁 فایل‌های من', callback_data: 'myfiles_1' },
        { text: '📤 آپلود فایل دیگر', callback_data: 'new_upload' },
      ],
    ],
  };
}

export function getMyFilesPaginationKeyboard(currentPage, totalPages, filesList = []) {
  const keyboard = [];

  // Individual file detail buttons
  for (const f of filesList) {
    const statusIcon = f.status === 'ACTIVE' ? '🟢' : f.status === 'EXPIRED' ? '⏳' : '🔴';
    const name = f.file_name || `فایل #${f.id}`;
    const truncatedName = name.length > 22 ? name.substring(0, 20) + '…' : name;
    keyboard.push([
      {
        text: `${statusIcon} ${truncatedName}`,
        callback_data: `file_view_${f.id}`,
      },
    ]);
  }

  // Navigation row
  const navRow = [];
  if (currentPage > 1) {
    navRow.push({ text: '◀️ قبلی', callback_data: `myfiles_${currentPage - 1}` });
  }
  navRow.push({ text: `صفحه ${currentPage} از ${totalPages || 1}`, callback_data: 'noop' });
  if (currentPage < totalPages) {
    navRow.push({ text: 'بعدی ▶️', callback_data: `myfiles_${currentPage + 1}` });
  }
  if (navRow.length > 0) {
    keyboard.push(navRow);
  }

  keyboard.push([{ text: '📤 ارسال فایل جدید', callback_data: 'new_upload' }]);

  return { inline_keyboard: keyboard };
}

export function getFileActionsKeyboard(file, shareLink) {
  const keyboard = [];

  if (file.status === 'ACTIVE') {
    keyboard.push([
      {
        text: '🔗 باز کردن لینک',
        url: shareLink,
      },
      {
        text: '🚫 غیرفعال‌سازی لینک',
        callback_data: `file_toggle_${file.id}`,
      },
    ]);
  } else if (file.status === 'DISABLED') {
    keyboard.push([
      {
        text: '✅ فعال‌سازی مجدد',
        callback_data: `file_toggle_${file.id}`,
      },
    ]);
  }

  keyboard.push([{ text: '🔙 بازگشت به لیست', callback_data: 'myfiles_1' }]);

  return { inline_keyboard: keyboard };
}

export function getCancelSessionKeyboard() {
  return {
    inline_keyboard: [[{ text: '❌ لغو نشست فعلی', callback_data: 'upload_cancel' }]],
  };
}
