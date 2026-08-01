import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  position: z.string().min(1),
  hireDate: z.string().or(z.date()),
  salary: z.number().positive(),
  status: z.enum(['Active', 'Inactive', 'Terminated']).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export async function getAll() {
  return prisma.employee.findMany({ include: { department: true }, orderBy: { name: 'asc' } });
}

export async function getById(id: string) {
  const employee = await prisma.employee.findUnique({ where: { id }, include: { department: true } });
  if (!employee) throw new AppError(404, 'Employee not found');
  return employee;
}

export async function create(data: z.infer<typeof createEmployeeSchema>) {
  const existing = await prisma.employee.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, 'Email already in use');
  return prisma.employee.create({
    data: {
      ...data,
      hireDate: new Date(data.hireDate),
    },
    include: { department: true },
  });
}

export async function update(id: string, data: z.infer<typeof updateEmployeeSchema>) {
  await getById(id);
  return prisma.employee.update({
    where: { id },
    data: {
      ...data,
      ...(data.hireDate ? { hireDate: new Date(data.hireDate) } : {}),
    },
    include: { department: true },
  });
}

export async function remove(id: string) {
  await getById(id);
  await prisma.employee.delete({ where: { id } });
}
