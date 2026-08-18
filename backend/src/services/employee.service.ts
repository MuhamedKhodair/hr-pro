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
  birthDate: z.string().or(z.date()).optional(),
  salary: z.number().positive(),
  status: z.enum(['Active', 'Inactive', 'Terminated']).optional(),
  reportsToId: z.string().optional(),
  shiftId: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

const employeeInclude = {
  department: true,
  manager: { select: { id: true, name: true } },
  shift: { select: { id: true, name: true, startTime: true, endTime: true } },
  _count: { select: { directReports: true } },
};

export async function getAll() {
  return prisma.employee.findMany({ include: employeeInclude, orderBy: { name: 'asc' } });
}

export async function getAllPaginated(options: { page: number; pageSize: number; search?: string }) {
  const { page, pageSize, search } = options;
  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { position: { contains: search } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);
  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getById(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      ...employeeInclude,
      directReports: { select: { id: true, name: true, position: true } },
    },
  });
  if (!employee) throw new AppError(404, 'Employee not found');
  return employee;
}

export const updateMeSchema = z.object({
  phone: z.string().optional(),
  birthDate: z.string().or(z.date()).optional(),
});

export async function getMe(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      ...employeeInclude,
      documents: { select: { id: true, label: true, fileName: true, mimeType: true, sizeBytes: true, uploadedAt: true }, orderBy: { uploadedAt: 'desc' } },
    },
  });
  if (!employee) throw new AppError(404, 'Employee not found');
  return employee;
}

export async function updateMe(employeeId: string, data: z.infer<typeof updateMeSchema>) {
  await getMe(employeeId);
  return prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.birthDate !== undefined && { birthDate: new Date(data.birthDate) }),
    },
    include: employeeInclude,
  });
}

export async function create(data: z.infer<typeof createEmployeeSchema>) {
  const existing = await prisma.employee.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, 'Email already in use');
  return prisma.employee.create({
    data: {
      ...data,
      departmentId: data.departmentId || undefined,
      reportsToId: data.reportsToId || undefined,
      shiftId: data.shiftId || undefined,
      hireDate: new Date(data.hireDate),
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
    },
    include: employeeInclude,
  });
}

export async function update(id: string, data: z.infer<typeof updateEmployeeSchema>) {
  await getById(id);
  if (data.reportsToId === id) throw new AppError(400, 'Employee cannot report to themselves');
  return prisma.employee.update({
    where: { id },
    data: {
      ...data,
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
      ...(data.reportsToId !== undefined ? { reportsToId: data.reportsToId || null } : {}),
      ...(data.shiftId !== undefined ? { shiftId: data.shiftId || null } : {}),
      ...(data.hireDate ? { hireDate: new Date(data.hireDate) } : {}),
      ...(data.birthDate !== undefined
        ? { birthDate: data.birthDate ? new Date(data.birthDate) : null }
        : {}),
    },
    include: employeeInclude,
  });
}

export async function getOrgTree() {
  const employees = await prisma.employee.findMany({
    where: { status: 'Active' },
    select: { id: true, name: true, position: true, reportsToId: true, department: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  type Node = (typeof employees)[number] & { children: Node[] };
  const map = new Map<string, Node>();
  employees.forEach((e) => map.set(e.id, { ...e, children: [] }));
  const roots: Node[] = [];
  map.forEach((node) => {
    if (node.reportsToId && map.has(node.reportsToId)) {
      map.get(node.reportsToId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export const importEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  department: z.string().optional().default(''),
  position: z.string().min(1),
  hireDate: z.string().min(1),
  salary: z.coerce.number().positive(),
  managerEmail: z.string().optional().default(''),
});

export async function bulkImport(rows: z.infer<typeof importEmployeeSchema>[]) {
  const results: { index: number; email: string; status: 'created' | 'skipped' | 'error'; message?: string; id?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await prisma.employee.findUnique({ where: { email: row.email } });
      if (existing) {
        results.push({ index: i, email: row.email, status: 'skipped', message: 'Email already exists' });
        continue;
      }

      let departmentId: string | undefined;
      if (row.department) {
        let dept = await prisma.department.findUnique({ where: { name: row.department } });
        if (!dept) dept = await prisma.department.create({ data: { name: row.department } });
        departmentId = dept.id;
      }

      let reportsToId: string | undefined;
      if (row.managerEmail) {
        const manager = await prisma.employee.findUnique({ where: { email: row.managerEmail } });
        if (manager) reportsToId = manager.id;
      }

      const emp = await prisma.employee.create({
        data: {
          name: row.name,
          email: row.email,
          phone: row.phone || undefined,
          departmentId,
          position: row.position,
          hireDate: new Date(row.hireDate),
          salary: row.salary,
          reportsToId,
        },
      });
      results.push({ index: i, email: row.email, status: 'created', id: emp.id });
    } catch (err: unknown) {
      results.push({
        index: i,
        email: row.email,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    total: rows.length,
    created: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    details: results,
  };
}

export async function remove(id: string) {
  await getById(id);
  await prisma.employee.delete({ where: { id } });
}
