import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { JwtPayload } from '../types';
import { z } from 'zod';
import { passwordFieldSchema, readPasswordHistory, pushPasswordHistory, isPasswordCompromised, PASSWORD_HISTORY_LIMIT } from '../lib/passwords';
import {
  generateSecret,
  buildOtpAuthUrl,
  qrDataUrl,
  verifyTotp,
  generateBackupCodes,
  hashBackupCode,
  consumeBackupCode,
} from '../lib/twoFactor';
import { queueEmail } from '../lib/email';
import { accountCreatedEmail } from '../lib/emailTemplates';
import { getSettings } from './settings.service';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface LoginAttemptState {
  failures: number;
  lockedUntil: number | null;
}

// In-memory lockout tracker (resets on server restart; sufficient for single-instance deployments)
const loginAttempts = new Map<string, LoginAttemptState>();

function sweepLoginAttempts() {
  if (loginAttempts.size <= 5000) return;
  const now = Date.now();
  for (const [key, state] of loginAttempts) {
    if (!state.lockedUntil || state.lockedUntil < now) loginAttempts.delete(key);
  }
}

function checkLockout(email: string) {
  sweepLoginAttempts();
  const state = loginAttempts.get(email.toLowerCase().trim());
  if (state?.lockedUntil && state.lockedUntil > Date.now()) {
    const minutes = Math.ceil((state.lockedUntil - Date.now()) / 60000);
    throw new AppError(429, `Too many failed login attempts. Account locked. Try again in ${minutes} minute(s)`, 'ACCOUNT_LOCKED');
  }
}

function recordFailure(email: string): boolean {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  let state = loginAttempts.get(key);
  if (!state || (state.lockedUntil && state.lockedUntil <= now)) {
    state = { failures: 0, lockedUntil: null };
  }
  state.failures += 1;
  if (state.failures >= MAX_LOGIN_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_MS;
    state.failures = 0;
  }
  loginAttempts.set(key, state);
  return state.lockedUntil !== null;
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordFieldSchema,
  role: z.enum(['Admin', 'HR', 'Employee']).optional(),
  employeeId: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordFieldSchema,
});

export const twoFactorCodeSchema = z.object({
  code: z.string().min(1).max(20),
});

export const twoFactorLoginSchema = z.object({
  twoFactorToken: z.string().min(1),
  code: z.string().min(1).max(20),
});

export interface LoginResult {
  user?: ReturnType<typeof sanitizeUser>;
  accessToken?: string;
  refreshToken?: string;
  needsTwoFactor?: boolean;
  twoFactorToken?: string;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d', jwtid: crypto.randomUUID() });
  return { accessToken, refreshToken };
}

function sanitizeUser(user: {
  id: string;
  email: string;
  role: string;
  employeeId: string | null;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    mustChangePassword: user.mustChangePassword,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

async function issueSession(user: { id: string; email: string; role: string; employeeId: string | null }, meta?: { userAgent?: string; ip?: string }) {
  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role as JwtPayload['role'], employeeId: user.employeeId };
  const tokens = generateTokens(payload);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(tokens.refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: meta?.userAgent?.slice(0, 200),
      ip: meta?.ip,
    },
  });
  return tokens;
}

async function revokeAllSessions(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function login(email: string, password: string, meta?: { userAgent?: string; ip?: string }): Promise<LoginResult> {
  checkLockout(email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (recordFailure(email)) {
      throw new AppError(429, 'Too many failed login attempts. Account locked for 15 minutes', 'ACCOUNT_LOCKED');
    }
    throw new AppError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    if (recordFailure(email)) {
      throw new AppError(429, 'Too many failed login attempts. Account locked for 15 minutes', 'ACCOUNT_LOCKED');
    }
    throw new AppError(401, 'Invalid credentials');
  }

  loginAttempts.delete(email.toLowerCase().trim());

  if (user.twoFactorEnabled) {
    const twoFactorToken = jwt.sign({ userId: user.id, purpose: '2fa' }, JWT_SECRET, { expiresIn: '5m' });
    return { needsTwoFactor: true, twoFactorToken };
  }

  const tokens = await issueSession(user, meta);
  return { user: sanitizeUser(user), ...tokens };
}

export async function register(data: z.infer<typeof registerSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, 'Email already registered');
  if (await isPasswordCompromised(data.password)) {
    throw new AppError(400, 'This password appears in known data breaches; choose a different one');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      role: data.role || 'Employee',
      employeeId: data.employeeId,
      mustChangePassword: true,
      passwordHistory: JSON.stringify([hashedPassword]),
    },
  });

  const email = accountCreatedEmail(user.email);
  queueEmail({ to: user.email, subject: email.subject, html: email.html }).catch(() => {});

  const { password: _password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword };
}

export const selfRegisterSchema = z.object({
  email: z.string().email(),
  password: passwordFieldSchema,
});

function isWhitelisted(email: string, whitelist: string): boolean {
  const target = email.toLowerCase();
  return whitelist.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).some((entry) => {
    if (entry.startsWith('@')) return target.endsWith(entry);
    return target === entry;
  });
}

export async function selfRegister(data: z.infer<typeof selfRegisterSchema>) {
  const settings = await getSettings();
  if (!settings.allowPublicRegistration) {
    throw new AppError(403, 'Self-registration is disabled by your administrator');
  }
  if (!isWhitelisted(data.email, settings.registrationWhitelist)) {
    throw new AppError(403, 'This email is not allowed to register; contact your administrator');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) throw new AppError(409, 'Email already registered');

  const employee = await prisma.employee.findFirst({
    where: { email: data.email, status: 'Active' },
  });
  if (!employee) {
    throw new AppError(403, 'No active employee record matches this email; contact your administrator');
  }

  if (await isPasswordCompromised(data.password)) {
    throw new AppError(400, 'This password appears in known data breaches; choose a different one');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      role: 'Employee',
      employeeId: employee.id,
      mustChangePassword: false,
      passwordHistory: JSON.stringify([hashedPassword]),
    },
  });

  const email = accountCreatedEmail(user.email);
  queueEmail({ to: user.email, subject: email.subject, html: email.html }).catch(() => {});

  const { password: _password, ...userWithoutPassword } = user;
  return { user: userWithoutPassword };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new AppError(400, 'Current password is incorrect');

  const history = readPasswordHistory(user.passwordHistory);
  for (const hash of history) {
    if (await bcrypt.compare(newPassword, hash)) {
      throw new AppError(400, `Password has been used recently; choose a password you have not used in the last ${PASSWORD_HISTORY_LIMIT} changes`);
    }
  }
  if (await isPasswordCompromised(newPassword)) {
    throw new AppError(400, 'This password appears in known data breaches; choose a different one');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        passwordHistory: JSON.stringify(pushPasswordHistory(history, hashedPassword)),
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function refresh(refreshToken: string, meta?: { userAgent?: string; ip?: string }) {
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw new AppError(401, 'Invalid refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });

  if (!stored || stored.revokedAt) {
    // Token was already used or revoked: possible theft, kill all sessions for the user
    await revokeAllSessions(decoded.userId);
    throw new AppError(401, 'Refresh token has been revoked');
  }
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    throw new AppError(401, 'Refresh token expired');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw new AppError(401, 'User not found');

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  return { ...(await issueSession(user, meta)), user: sanitizeUser(user) };
}

export async function logout(refreshToken: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
  if (stored && !stored.revokedAt) {
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  }
}

export async function listSessions(userId: string) {
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}

export async function revokeSession(userId: string, sessionId: string) {
  const session = await prisma.refreshToken.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) throw new AppError(404, 'Session not found');
  await prisma.refreshToken.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });
  if (!user) throw new AppError(404, 'User not found');
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// --- Two-factor authentication ---

async function getUserOrThrow(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

/** Returns the TOTP secret + QR code so the user can enroll their authenticator app. */
export async function setupTwoFactor(userId: string) {
  const user = await getUserOrThrow(userId);
  if (user.twoFactorEnabled) throw new AppError(400, 'Two-factor authentication is already enabled');

  const secret = user.twoFactorSecret || generateSecret();
  if (!user.twoFactorSecret) {
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
  }

  const otpauthUrl = buildOtpAuthUrl(secret, user.email);
  const qr = await qrDataUrl(otpauthUrl);
  return { secret, otpauthUrl, qr };
}

/** Verify a code and enable 2FA. Returns one-time backup codes. */
export async function enableTwoFactor(userId: string, code: string) {
  const user = await getUserOrThrow(userId);
  if (user.twoFactorEnabled) throw new AppError(400, 'Two-factor authentication is already enabled');
  if (!user.twoFactorSecret) throw new AppError(400, 'Run two-factor setup first');

  if (!(await verifyTotp(user.twoFactorSecret, code))) {
    throw new AppError(400, 'Invalid verification code');
  }

  const backupCodes = generateBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorVerifiedAt: new Date(),
      twoFactorBackupCodes: JSON.stringify(backupCodes.map(hashBackupCode)),
    },
  });
  return { backupCodes };
}

/** Disable 2FA after verifying with a TOTP or backup code. */
export async function disableTwoFactor(userId: string, code: string) {
  const user = await getUserOrThrow(userId);
  if (!user.twoFactorEnabled) throw new AppError(400, 'Two-factor authentication is not enabled');

  const validTotp = user.twoFactorSecret ? await verifyTotp(user.twoFactorSecret, code) : false;
  const backupMatched = consumeBackupCode(user.twoFactorBackupCodes, code) !== null;
  if (!validTotp && !backupMatched) throw new AppError(400, 'Invalid verification code');

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorVerifiedAt: null,
      twoFactorBackupCodes: '[]',
    },
  });
}

/** Complete the second step of a two-factor login. Issues the real session. */
export async function verifyTwoFactorLogin(
  twoFactorToken: string,
  code: string,
  meta?: { userAgent?: string; ip?: string },
): Promise<LoginResult> {
  let decoded: { userId: string; purpose: string };
  try {
    decoded = jwt.verify(twoFactorToken, JWT_SECRET) as { userId: string; purpose: string };
  } catch {
    throw new AppError(401, 'Verification session expired, please sign in again');
  }
  if (decoded.purpose !== '2fa' || !decoded.userId) {
    throw new AppError(401, 'Invalid verification session');
  }

  const user = await getUserOrThrow(decoded.userId);
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError(400, 'Two-factor authentication is not enabled for this account');
  }

  const validTotp = await verifyTotp(user.twoFactorSecret, code);
  const remainingBackupCodes = consumeBackupCode(user.twoFactorBackupCodes, code);
  if (!validTotp && remainingBackupCodes === null) {
    throw new AppError(400, 'Invalid verification code');
  }

  if (remainingBackupCodes) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: JSON.stringify(remainingBackupCodes) },
    });
  }

  if (!user.twoFactorVerifiedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorVerifiedAt: new Date() } });
  }

  const tokens = await issueSession(user, meta);
  return { user: sanitizeUser(user), ...tokens };
}
