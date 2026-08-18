import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';
import { registerSchema, changePasswordSchema } from './auth.service';
import { register } from './auth.service';
import { readPasswordHistory, pushPasswordHistory, isPasswordCompromised } from '../lib/passwords';
import { queueEmail } from '../lib/email';
import { passwordResetEmail } from '../lib/emailTemplates';

export const createUserSchema = registerSchema;
export const resetPasswordSchema = z.object({ password: changePasswordSchema.shape.newPassword });

export async function listUsers() {
  const users = await prisma.user.findMany({
    include: {
      employee: { select: { id: true, name: true, position: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return users.map(({ password, ...user }) => ({
    ...user,
    employee: user.employee ?? null,
  }));
}

export async function createUser(data: z.infer<typeof createUserSchema>) {
  if (data.employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new AppError(404, 'Linked employee not found');
    const linked = await prisma.user.findUnique({ where: { employeeId: data.employeeId } });
    if (linked) throw new AppError(409, 'This employee already has a login account');
  }
  const result = await register(data);
  return result.user;
}

export async function resetPassword(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const history = readPasswordHistory(user.passwordHistory);
  for (const hash of history) {
    if (await bcrypt.compare(newPassword, hash)) {
      throw new AppError(400, 'Password has been used recently; choose a different one');
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
        mustChangePassword: true,
        passwordHistory: JSON.stringify(pushPasswordHistory(history, hashedPassword)),
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  const email = passwordResetEmail(user.email);
  queueEmail({ to: user.email, subject: email.subject, html: email.html }).catch(() => {});
}

export async function removeUser(userId: string, requesterId: string) {
  if (userId === requesterId) throw new AppError(400, 'You cannot delete your own account');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  await prisma.$transaction([
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
