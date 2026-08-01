import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export async function getAll() {
  return prisma.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: 'asc' } });
}

export async function getById(id: string) {
  const dept = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
  if (!dept) throw new AppError(404, 'Department not found');
  return dept;
}

export async function create(data: z.infer<typeof createDepartmentSchema>) {
  const existing = await prisma.department.findUnique({ where: { name: data.name } });
  if (existing) throw new AppError(409, 'Department name already exists');
  return prisma.department.create({ data });
}

export async function update(id: string, data: z.infer<typeof updateDepartmentSchema>) {
  await getById(id);
  return prisma.department.update({ where: { id }, data });
}

export async function remove(id: string) {
  await getById(id);
  const count = await prisma.employee.count({ where: { departmentId: id } });
  if (count > 0) throw new AppError(400, 'Cannot delete department with existing employees');
  await prisma.department.delete({ where: { id } });
}
