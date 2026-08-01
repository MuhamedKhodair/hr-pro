import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';

export const checkInSchema = z.object({
  employeeId: z.string(),
});

export async function getToday(employeeId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const where: any = { date: { gte: today, lt: tomorrow } };
  if (employeeId) where.employeeId = employeeId;

  return prisma.attendance.findMany({
    where,
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

export async function checkIn(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AppError(404, 'Employee not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await prisma.attendance.findFirst({
    where: { employeeId, date: { gte: today, lt: tomorrow } },
  });

  if (existing) throw new AppError(409, 'Already checked in today');

  return prisma.attendance.create({
    data: { employeeId, checkIn: new Date() },
  });
}

export async function checkOut(employeeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const record = await prisma.attendance.findFirst({
    where: { employeeId, date: { gte: today, lt: tomorrow } },
  });

  if (!record) throw new AppError(404, 'No check-in found for today');
  if (record.checkOut) throw new AppError(409, 'Already checked out today');

  return prisma.attendance.update({
    where: { id: record.id },
    data: { checkOut: new Date() },
  });
}

export async function getMonthly(employeeId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  return prisma.attendance.findMany({
    where: { employeeId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });
}
