import crypto from 'crypto';
import { generateSecret as otpGenerateSecret, generateURI, verify as otpVerify } from 'otplib';
import QRCode from 'qrcode';

export const TWO_FACTOR_ISSUER = 'HR Pro';

export function generateSecret(): string {
  return otpGenerateSecret();
}

export function buildOtpAuthUrl(secret: string, email: string): string {
  return generateURI({ issuer: TWO_FACTOR_ISSUER, label: email, secret });
}

export async function qrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  try {
    const result = await otpVerify({ secret, token: token.trim() });
    return result.valid;
  } catch {
    return false;
  }
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  while (codes.length < count) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify a backup code against the stored hash list. Returns the remaining
 * (unused) code hashes after consuming the matched one, or null if no match.
 */
export function consumeBackupCode(storedHashesJson: string, code: string): string[] | null {
  let hashes: string[];
  try {
    hashes = JSON.parse(storedHashesJson);
  } catch {
    hashes = [];
  }
  const target = hashBackupCode(code.trim());
  if (!hashes.includes(target)) return null;
  const remaining = hashes.filter((h) => h !== target);
  return remaining;
}