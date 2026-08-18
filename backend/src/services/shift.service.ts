import prisma from '../lib/prisma';
import { z } from 'zod';
import { AppError } from '../lib/errors';

export const shiftSchema = z.object({
  name: z.string().min(1).max(80),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  description: z.string().max(300).optional().default(''),
});

export const assignShiftSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1),
});

export async function getAllShifts() {
  return prisma.shift.findMany({
    include: {
      employees: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getShiftEmployees(shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      employees: {
        select: {
          id: true,
          name: true,
          position: true,
          department: { select: { name: true } },
          status: true,
        },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!shift) throw new AppError(404, 'Shift not found');
  return shift.employees;
}

export async function createShift(data: z.infer<typeof shiftSchema>) {
  return prisma.shift.create({ data });
}

export async function updateShift(id: string, data: z.infer<typeof shiftSchema>) {
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Shift not found');
  return prisma.shift.update({ where: { id }, data });
}

export async function deleteShift(id: string) {
  const existing = await prisma.shift.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });
  if (!existing) throw new AppError(404, 'Shift not found');
  if (existing._count.employees > 0) {
    throw new AppError(400, 'Cannot delete a shift that is assigned to employees; unassign them first');
  }
  return prisma.shift.delete({ where: { id } });
}

export async function assignEmployees(shiftId: string, employeeIds: string[]) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new AppError(404, 'Shift not found');

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true },
  });
  if (employees.length !== employeeIds.length) {
    throw new AppError(400, 'One or more employees were not found');
  }

  await prisma.$transaction(
    employeeIds.map((employeeId) =>
      prisma.employee.update({
        where: { id: employeeId },
        data: { shiftId },
      }),
    ),
  );

  return prisma.shift.findUnique({
    where: { id: shiftId },
    include: { _count: { select: { employees: true } } },
  });
}

export async function unassignEmployee(shiftId: string, employeeId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new AppError(404, 'Shift not found');

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.shiftId !== shiftId) {
    throw new AppError(400, 'Employee is not assigned to this shift');
  }

  return prisma.employee.update({
    where: { id: employeeId },
    data: { shiftId: null },
  });
}

export async function getUnassignedEmployees() {
  return prisma.employee.findMany({
    where: { shiftId: null, status: 'Active', departmentId: { not: null } },
    select: {
      id: true,
      name: true,
      position: true,
      department: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getMyShift(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { shiftId: true },
  });
  if (!employee?.shiftId) return null;
  return prisma.shift.findUnique({
    where: { id: employee.shiftId },
    include: { _count: { select: { employees: true } } },
  });
}