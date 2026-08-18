import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import { queueEmail } from '../lib/email';
import { leaveReviewedEmail } from '../lib/emailTemplates';

type Db = PrismaClient | Prisma.TransactionClient;

export const leaveBaseSchema = z.object({
  employeeId: z.string().optional(),
  type: z.string().min(1),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  halfDayStart: z.boolean().optional().default(false),
  halfDayEnd: z.boolean().optional().default(false),
  reason: z.string().min(1),
  attachmentUrl: z.string().optional(),
});

export const createLeaveSchema = leaveBaseSchema.refine(
  (d) => new Date(d.startDate) <= new Date(d.endDate),
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export const updateLeaveSchema = leaveBaseSchema.omit({ employeeId: true }).partial();

export const reviewLeaveSchema = z.object({
  status: z.enum(['Approved', 'Rejected']),
  comment: z.string().optional(),
});

export const cancelLeaveSchema = z.object({
  cancelReason: z.string().min(1),
});

const DEFAULT_WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMidnight(d: Date | string): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getWorkingDays(tx: Db = prisma): Promise<string[]> {
  const settings = await tx.setting.findUnique({ where: { id: 'singleton' } });
  if (!settings?.workingDays) return [...DEFAULT_WORKING_DAYS];
  const parsed = settings.workingDays.split(',') as string[];
  const valid = parsed.filter((d) => (DAY_OPTIONS as readonly string[]).includes(d));
  return valid.length ? valid : [...DEFAULT_WORKING_DAYS];
}

export async function getHolidaysInRange(startDate: Date | string, endDate: Date | string, tx: Db = prisma): Promise<Date[]> {
  const rows = await tx.holiday.findMany({
    where: { date: { gte: toMidnight(startDate), lte: toMidnight(endDate) } },
    select: { date: true },
  });
  return rows.map((r) => toMidnight(r.date));
}

export function calculateSegments(
  startDate: Date | string,
  endDate: Date | string,
  halfDayStart = false,
  halfDayEnd = false,
  workingDays?: string[],
  holidays?: Date[],
): { total: number; segments: { year: number; days: number }[] } {
  const s = toMidnight(startDate);
  const e = toMidnight(endDate);
  const holidaySet = new Set<number>((holidays ?? []).map((h) => toMidnight(h).getTime()));

  const segments: { year: number; days: number }[] = [];
  let currentYear = -1;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    if (year !== currentYear) {
      currentYear = year;
      segments.push({ year, days: 0 });
    }
    if (!workingDays || workingDays.includes(DAY_NAMES[d.getDay()])) {
      if (!holidaySet.has(d.getTime())) {
        segments[segments.length - 1].days += 1;
      }
    }
  }

  if (halfDayStart && segments.length) segments[0].days -= 0.5;
  if (halfDayEnd && segments.length) segments[segments.length - 1].days -= 0.5;
  for (const seg of segments) {
    if (seg.days < 0) seg.days = 0;
  }

  let total = segments.reduce((sum, seg) => sum + seg.days, 0);
  if (total < 0.5 && segments.length) {
    segments[0].days += 0.5 - total;
    total = 0.5;
  }
  return { total, segments };
}

export function calculateTotalDays(
  startDate: Date | string,
  endDate: Date | string,
  halfDayStart = false,
  halfDayEnd = false,
  workingDays?: string[],
  holidays?: Date[],
): number {
  return calculateSegments(startDate, endDate, halfDayStart, halfDayEnd, workingDays, holidays).total;
}

export const TRACKED_LEAVE_TYPES = ['Vacation', 'Sick'] as const;

export async function getTypeCap(type: string, tx: Db = prisma): Promise<number | null> {
  const settings = await tx.setting.findUnique({ where: { id: 'singleton' } });
  if (!settings) return null;
  switch (type) {
    case 'Vacation':
      return settings.vacationMaxDaysPerRequest;
    case 'Sick':
      return settings.sickMaxDaysPerRequest;
    default:
      return settings.unpaidMaxDaysPerRequest;
  }
}

export async function getBalances(employeeId: string, year?: number, tx: Db = prisma) {
  const settings = await tx.setting.findUnique({ where: { id: 'singleton' } });
  const yearTarget = year ?? new Date().getFullYear();
  const yearStart = new Date(yearTarget, 0, 1);
  const yearEnd = new Date(yearTarget, 11, 31, 23, 59, 59);

  const entitlementMap: Record<string, number> = {
    Vacation: settings?.annualLeaveEntitlement ?? 21,
    Sick: settings?.sickLeaveEntitlement ?? 15,
  };

  const approved = await tx.leaveRequest.findMany({
    where: {
      employeeId,
      status: 'Approved',
      isCancelled: false,
      type: { in: [...TRACKED_LEAVE_TYPES] },
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
    },
    select: { type: true, totalDays: true, startDate: true, yearSplit: true },
  });

  const used: Record<string, number> = {};
  for (const l of approved) {
    let days: number;
    if (l.yearSplit) {
      try {
        const parsed = JSON.parse(l.yearSplit) as { year: number; days: number }[];
        days = parsed.filter((s) => s.year === yearTarget).reduce((sum, s) => sum + s.days, 0);
      } catch {
        days = 0;
      }
    } else {
      days = l.startDate.getFullYear() === yearTarget ? l.totalDays : 0;
    }
    if (days) used[l.type] = (used[l.type] ?? 0) + days;
  }

  const balances = TRACKED_LEAVE_TYPES.map((type) => {
    const entitlement = entitlementMap[type];
    const usedDays = used[type] ?? 0;
    return { type, entitlement, used: usedDays, remaining: Math.max(0, entitlement - usedDays) };
  });

  const pending = await tx.leaveRequest.count({
    where: {
      employeeId,
      status: 'Pending',
      isCancelled: false,
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
    },
  });

  return { year: yearTarget, balances, pendingRequests: pending };
}

export async function getAll(status?: string, employeeId?: string, employeeIds?: string[]) {
  const where: any = {};
  if (status) where.status = status;
  if (employeeIds?.length) where.employeeId = { in: employeeIds };
  else if (employeeId) where.employeeId = employeeId;

  return prisma.leaveRequest.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true, departmentId: true } },
      reviewer: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllPaginated(options: {
  page: number;
  pageSize: number;
  status?: string;
  employeeId?: string;
  employeeIds?: string[];
}) {
  const { page, pageSize, status, employeeId, employeeIds } = options;
  const where: any = {};
  if (status) where.status = status;
  if (employeeIds?.length) where.employeeId = { in: employeeIds };
  else if (employeeId) where.employeeId = employeeId;

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, departmentId: true } },
        reviewer: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getAllForExport() {
  return prisma.leaveRequest.findMany({
    include: {
      employee: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
      reviewer: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: { id: true, name: true, email: true, departmentId: true, reportsToId: true, user: { select: { id: true } } },
      },
      reviewer: { select: { id: true, email: true } },
    },
  });
  if (!leave) throw new AppError(404, 'Leave request not found');
  return leave;
}

export async function create(data: z.infer<typeof createLeaveSchema> & { employeeId: string }) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new AppError(404, 'Employee not found');

    const workingDays = await getWorkingDays(tx);
    const holidays = await getHolidaysInRange(data.startDate, data.endDate, tx);
    const { total: totalDays, segments } = calculateSegments(
      data.startDate,
      data.endDate,
      data.halfDayStart,
      data.halfDayEnd,
      workingDays,
      holidays,
    );

    const cap = await getTypeCap(data.type, tx);
    if (cap !== null && totalDays > cap) {
      throw new AppError(400, `${data.type} leave exceeds the maximum of ${cap} days per request`);
    }

    if ((TRACKED_LEAVE_TYPES as readonly string[]).includes(data.type)) {
      for (const seg of segments) {
        const { balances } = await getBalances(data.employeeId, seg.year, tx);
        const balance = balances.find((b) => b.type === data.type);
        if (balance && seg.days > balance.remaining) {
          throw new AppError(
            400,
            `Insufficient ${data.type} balance for ${seg.year}: ${balance.remaining} days remaining, ${seg.days} requested`,
          );
        }
      }
    }

    return tx.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        halfDayStart: data.halfDayStart ?? false,
        halfDayEnd: data.halfDayEnd ?? false,
        totalDays,
        yearSplit: JSON.stringify(segments),
        reason: data.reason,
        attachmentUrl: data.attachmentUrl,
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, reportsToId: true, user: { select: { id: true } } },
        },
        reviewer: { select: { id: true, email: true } },
      },
    });
  });
}

export async function update(id: string, data: z.infer<typeof updateLeaveSchema>, requesterEmployeeId: string) {
  return prisma.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, name: true, email: true, departmentId: true, reportsToId: true, user: { select: { id: true } } },
        },
        reviewer: { select: { id: true, email: true } },
      },
    });
    if (!leave) throw new AppError(404, 'Leave request not found');
    if (leave.employeeId !== requesterEmployeeId) throw new AppError(403, 'You can only edit your own leave requests');
    if (leave.status !== 'Pending') throw new AppError(400, 'Only pending leave requests can be edited');
    if (leave.isCancelled) throw new AppError(400, 'Cannot edit a cancelled request');

    const startDate = data.startDate ? new Date(data.startDate) : leave.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : leave.endDate;
    const halfDayStart = data.halfDayStart ?? leave.halfDayStart;
    const halfDayEnd = data.halfDayEnd ?? leave.halfDayEnd;
    const workingDays = await getWorkingDays(tx);
    const holidays = await getHolidaysInRange(startDate, endDate, tx);
    const { total: totalDays, segments } = calculateSegments(
      startDate,
      endDate,
      halfDayStart,
      halfDayEnd,
      workingDays,
      holidays,
    );

    const type = data.type ?? leave.type;
    const cap = await getTypeCap(type, tx);
    if (cap !== null && totalDays > cap) {
      throw new AppError(400, `${type} leave exceeds the maximum of ${cap} days per request`);
    }

    if ((TRACKED_LEAVE_TYPES as readonly string[]).includes(type)) {
      for (const seg of segments) {
        const { balances } = await getBalances(leave.employeeId, seg.year, tx);
        const balance = balances.find((b) => b.type === type);
        if (balance && seg.days > balance.remaining) {
          throw new AppError(
            400,
            `Insufficient ${type} balance for ${seg.year}: ${balance.remaining} days remaining, ${seg.days} requested`,
          );
        }
      }
    }

    return tx.leaveRequest.update({
      where: { id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        startDate,
        endDate,
        halfDayStart,
        halfDayEnd,
        totalDays,
        yearSplit: JSON.stringify(segments),
        ...(data.reason !== undefined && { reason: data.reason }),
        ...(data.attachmentUrl !== undefined && { attachmentUrl: data.attachmentUrl }),
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
      },
    });
  });
}

export async function cancel(id: string, cancelReason: string, requesterEmployeeId: string) {
  const leave = await getById(id);
  if (leave.employeeId !== requesterEmployeeId) throw new AppError(403, 'You can only cancel your own leave requests');
  if (leave.status !== 'Pending') throw new AppError(400, 'Only pending leave requests can be cancelled');
  if (leave.isCancelled) throw new AppError(400, 'Already cancelled');

  return prisma.leaveRequest.update({
    where: { id },
    data: { isCancelled: true, cancelledAt: new Date(), cancelReason },
    include: {
      employee: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function review(
  id: string,
  status: 'Approved' | 'Rejected',
  reviewedBy: string,
  comment?: string,
  requesterRole?: string,
  requesterEmployeeId?: string,
) {
  const leave = await getById(id);
  if (leave.status !== 'Pending') throw new AppError(400, 'Leave request already reviewed');
  if (leave.isCancelled) throw new AppError(400, 'Cannot review a cancelled request');

  if (requesterRole === 'Employee') {
    if (!requesterEmployeeId || leave.employee.reportsToId !== requesterEmployeeId) {
      throw new AppError(403, 'You can only review leave requests from your direct reports');
    }
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: { status, reviewedBy, reviewComment: comment },
    include: {
      employee: { select: { id: true, name: true, email: true, user: { select: { id: true } } } },
      reviewer: { select: { id: true, email: true } },
    },
  });

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const email = leaveReviewedEmail({
    employeeName: updated.employee.name,
    leaveType: updated.type,
    startDate: fmt(updated.startDate),
    endDate: fmt(updated.endDate),
    status: updated.status as 'Approved' | 'Rejected',
    comment: updated.reviewComment ?? undefined,
  });
  queueEmail({ to: updated.employee.email, subject: email.subject, html: email.html }).catch(() => {});

  return updated;
}
