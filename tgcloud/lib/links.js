/**
 * @file Secure Deep Link and Share Token Generator
 * @description Generates 128-bit entropy cryptographically secure URL-safe tokens
 * adhering to Telegram's 64-character start parameter limit.
 */
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { files } from '../schema.js';
import { LIMITS } from './constants.js';

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generates a cryptographically secure random string with minimum 128 bits of entropy.
 * 22 base62 characters provide log2(62^22) ≈ 131 bits of entropy.
 */
export function generateSecureToken(length = 22) {
  // Use crypto API available in V8 Isolate runtime
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('SECURITY_BLOCKER: Cryptographically secure RNG (crypto.getRandomValues) is not available in runtime.');
  }

  const randomBytes = new Uint8Array(length);
  cryptoObj.getRandomValues(randomBytes);

  let token = '';
  for (let i = 0; i < length; i++) {
    token += BASE62_CHARS[randomBytes[i] % BASE62_CHARS.length];
  }
  return token;
}

/**
 * Generates an uncollided unique share token for a file.
 */
export async function generateUniqueShareToken(maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rawToken = generateSecureToken(24);
    const candidate = `${LIMITS.TOKEN_PREFIX}${rawToken}`;

    if (candidate.length > LIMITS.START_PARAM_MAX_LENGTH) {
      throw new Error('Token length exceeds Telegram 64-character start parameter limit.');
    }

    // Check collision in SQLite
    const existing = await db.select()
      .from(files)
      .where(eq(files.share_token, candidate))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }
  }

  throw new Error('Failed to generate a unique share token after maximum attempts.');
}

/**
 * Constructs the full Telegram deep link.
 */
export function buildDeepLink(botUsername, shareToken) {
  const cleanUsername = String(botUsername || 'FileLinkBot').replace(/^@/, '');
  return `https://t.me/${cleanUsername}?start=${shareToken}`;
}

/**
 * Extracts and validates a share token from a /start command.
 * E.g. "/start f_abc123" -> "f_abc123"
 */
export function extractShareToken(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.trim().match(/^\/start\s+(f_[A-Za-z0-9_-]{10,60})$/);
  return match ? match[1] : null;
}
