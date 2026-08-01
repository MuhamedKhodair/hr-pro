import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { JwtPayload } from '../types';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['Admin', 'HR', 'Employee']).optional(),
  employeeId: z.string().optional(),
});

function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
  const tokens = generateTokens(payload);
  return { user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId }, ...tokens };
}

export async function register(data: z.infer<typeof registerSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, 'Email already registered');

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { email: data.email, password: hashedPassword, role: data.role || 'Employee', employeeId: data.employeeId },
  });

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
  const tokens = generateTokens(payload);
  return { user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId }, ...tokens };
}

export async function refresh(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) throw new AppError(401, 'User not found');

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
  return generateTokens(payload);
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
