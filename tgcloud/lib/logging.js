/**
 * @file Structured Logger
 * @description Safe, auditable JSON logger for Telegram Serverless.
 * Masks tokens, prevents sensitive leakage, and measures duration.
 */

export function logEvent({
  eventType,
  requestId = null,
  userId = null,
  fileId = null,
  operation,
  status = 'SUCCESS',
  errorCode = null,
  durationMs = null,
  extra = null,
}) {
  const logEntry = {
    event_type: eventType,
    request_id: requestId,
    user_id: userId,
    file_id: fileId,
    operation,
    status,
    error_code: errorCode,
    duration_ms: durationMs,
    timestamp: Math.floor(Date.now() / 1000),
  };

  if (extra && typeof extra === 'object') {
    // Sanitize extra fields to prevent credential leakage
    const sanitized = {};
    for (const [k, v] of Object.entries(extra)) {
      if (/token|secret|key|password|auth/i.test(k)) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = v;
      }
    }
    logEntry.extra = sanitized;
  }

  // Telegram Serverless stdout
  if (status === 'ERROR' || errorCode) {
    console.error(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}
