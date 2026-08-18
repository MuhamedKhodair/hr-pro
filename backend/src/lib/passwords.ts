import crypto from 'crypto';
import { z } from 'zod';

export const PASSWORD_HISTORY_LIMIT = 3;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number';

export function validatePassword(password: string): string | null {
  if (password.length < 8) return PASSWORD_POLICY_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_POLICY_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_POLICY_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_POLICY_MESSAGE;
  return null;
}

export const passwordFieldSchema = z
  .string()
  .min(1)
  .refine((p) => validatePassword(p) === null, { message: PASSWORD_POLICY_MESSAGE });

export function readPasswordHistory(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    return [];
  }
}

export function pushPasswordHistory(history: string[], newHash: string): string[] {
  return [...history, newHash].slice(-PASSWORD_HISTORY_LIMIT);
}

/**
 * Opt-in HaveIBeenPwned k-anonymity check. Never blocks auth when disabled or
 * when the breach API is unreachable (fails open for availability).
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  if (process.env.ENABLE_PWNED_CHECK !== 'true') return false;
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const text = await res.text();
    return text.split('\r\n').some((line) => line.split(':')[0] === suffix);
  } catch {
    return false;
  }
}