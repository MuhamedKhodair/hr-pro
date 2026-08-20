import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';

export const checkInSchema = z.object({
  employeeId: z.string(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

export const manualEntrySchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().or(z.date()),
  checkIn: z.string().or(z.date()).optional().nullable(),
  checkOut: z.string().or(z.date()).optional().nullable(),
  status: z.enum(['Present', 'Absent', 'HalfDay']).optional(),
  overtimeHrs: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const bulkImportRowSchema = z.object({
  employeeEmail: z.string().email(),
  date: z.string(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(['Present', 'Absent', 'HalfDay']).optional().default('Present'),
  overtimeHrs: z.coerce.number().min(0).max(12).optional(),
  notes: z.string().optional(),
});

export async function getToday(employeeId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const where: Record<string, unknown> = { date: { gte: today, lt: tomorrow } };
  if (employeeId) where.employeeId = employeeId;

  return prisma.attendance.findMany({
    where,
    include: { employee: { select: { id: true, name: true, email: true, departmentId: true } } },
  });
}

export async function getDateRange(
  employeeId: string | undefined,
  startDate: string | Date,
  endDate: string | Date,
) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const where: Record<string, unknown> = { date: { gte: start, lte: end } };
  if (employeeId) where.employeeId = employeeId;

  return prisma.attendance.findMany({
    where,
    include: {
      employee: {
        select: { id: true, name: true, email: true, department: { select: { name: true } } },
      },
    },
    orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }],
  });
}

export async function checkIn(employeeId: string, location?: { latitude?: number | null; longitude?: number | null }) {
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
    data: {
      employeeId,
      checkIn: new Date(),
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    },
  });
}

export async function checkOut(employeeId: string, location?: { latitude?: number | null; longitude?: number | null }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const record = await prisma.attendance.findFirst({
    where: { employeeId, date: { gte: today, lt: tomorrow } },
  });

  if (!record) throw new AppError(404, 'No check-in found for today');
  if (record.checkOut) throw new AppError(409, 'Already checked out today');

  const checkOutTime = new Date();
  const WORK_END_HOUR = 17;
  const workedMs = checkOutTime.getTime() - new Date(record.checkIn!).getTime();
  const workedHours = workedMs / 3600000;
  const overtimeHrs = workedHours > 8 ? Math.round((workedHours - 8) * 100) / 100 : record.overtimeHrs;

  return prisma.attendance.update({
    where: { id: record.id },
    data: {
      checkOut: checkOutTime,
      overtimeHrs,
      latitude: record.latitude ?? location?.latitude ?? null,
      longitude: record.longitude ?? location?.longitude ?? null,
    },
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

export async function manualEntry(data: z.infer<typeof manualEntrySchema>) {
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw new AppError(404, 'Employee not found');

  const date = new Date(data.date);
  date.setHours(0, 0, 0, 0);

  return prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date } },
    create: {
      employeeId: data.employeeId,
      date,
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      status: data.status ?? 'Present',
      overtimeHrs: data.overtimeHrs ?? 0,
      notes: data.notes,
    },
    update: {
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      status: data.status,
      overtimeHrs: data.overtimeHrs,
      notes: data.notes,
    },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

export async function bulkImport(
  rows: z.infer<typeof bulkImportRowSchema>[],
) {
  const results: { index: number; email: string; status: 'created' | 'updated' | 'error'; message?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const employee = await prisma.employee.findUnique({ where: { email: row.employeeEmail } });
      if (!employee) {
        results.push({ index: i, email: row.employeeEmail, status: 'error', message: 'Employee not found' });
        continue;
      }

      const date = new Date(row.date);
      date.setHours(0, 0, 0, 0);

      const existing = await prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId: employee.id, date } },
      });

      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: employee.id, date } },
        create: {
          employeeId: employee.id,
          date,
          checkIn: row.checkIn ? new Date(`${row.date}T${row.checkIn}`) : null,
          checkOut: row.checkOut ? new Date(`${row.date}T${row.checkOut}`) : null,
          status: row.status,
          overtimeHrs: row.overtimeHrs ?? 0,
          notes: row.notes,
        },
        update: {
          checkIn: row.checkIn ? new Date(`${row.date}T${row.checkIn}`) : null,
          checkOut: row.checkOut ? new Date(`${row.date}T${row.checkOut}`) : null,
          status: row.status,
          overtimeHrs: row.overtimeHrs ?? 0,
          notes: row.notes,
        },
      });

      results.push({ index: i, email: row.employeeEmail, status: existing ? 'updated' : 'created' });
    } catch (err: unknown) {
      results.push({
        index: i,
        email: row.employeeEmail,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    total: rows.length,
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    errors: results.filter((r) => r.status === 'error').length,
    details: results,
  };
}
