import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const COMMON = ['password', '123456', 'qwerty', 'letmein', 'welcome', 'fundline', 'northfield', 'admin', 'changeme'];

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }

/** Returns an error message, or null when the password meets the policy. */
export function passwordProblem(pw: string, email?: string): string | null {
  if (pw.length < 12) return 'Use at least 12 characters.';
  if (pw.length > 128) return 'Use 128 characters or fewer.';
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  if (kinds < 3) return 'Mix at least three of: lowercase, uppercase, numbers, symbols.';
  const low = pw.toLowerCase();
  if (COMMON.some(w => low.includes(w))) return 'Avoid common words like “password” or the product name.';
  if (email && low.includes(email.split('@')[0].toLowerCase())) return 'Don’t include your email name in the password.';
  return null;
}

/** Temporary password for new users and resets: readable, meets policy. */
export function temporaryPassword() {
  const words = ['River', 'Cedar', 'Maple', 'Harbor', 'Prairie', 'Summit', 'Lantern', 'Orchard', 'Granite', 'Willow'];
  const b = randomBytes(6);
  return `${words[b[0] % words.length]}-${words[b[1] % words.length].toLowerCase()}-${(b.readUInt16BE(2) % 9000) + 1000}!${'#$%&*'[b[4] % 5]}`;
}
