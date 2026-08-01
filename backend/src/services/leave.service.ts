import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';

export const createLeaveSchema = z.object({
  employeeId: z.string().optional(),
  type: z.string().min(1),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  reason: z.string().min(1),
});

export const reviewLeaveSchema = z.object({
  status: z.enum(['Approved', 'Rejected']),
});

export async function getAll(status?: string, employeeId?: string) {
  const where: any = {};
  if (status) where.status = status;
  if (employeeId) where.employeeId = employeeId;

  return prisma.leaveRequest.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true, departmentId: true } },
      reviewer: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, email: true, departmentId: true } },
      reviewer: { select: { id: true, email: true } },
    },
  });
  if (!leave) throw new AppError(404, 'Leave request not found');
  return leave;
}

export async function create(data: z.infer<typeof createLeaveSchema> & { employeeId: string }) {
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw new AppError(404, 'Employee not found');

  return prisma.leaveRequest.create({
    data: {
      employeeId: data.employeeId,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function review(id: string, status: 'Approved' | 'Rejected', reviewedBy: string) {
  const leave = await getById(id);
  if (leave.status !== 'Pending') throw new AppError(400, 'Leave request already reviewed');

  return prisma.leaveRequest.update({
    where: { id },
    data: { status, reviewedBy },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, email: true } },
    },
  });
}
