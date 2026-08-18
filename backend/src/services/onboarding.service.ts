import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';
import { notifyRole } from './notification.service';

export const taskSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('General'),
  isRequired: z.boolean().default(true),
  orderIndex: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const statusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
  notes: z.string().optional(),
});

// ---------- Template tasks ----------

export async function listTasks() {
  return prisma.onboardingTask.findMany({
    where: { active: true },
    orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
  });
}

export async function listAllTasks() {
  return prisma.onboardingTask.findMany({
    orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { assignments: true } } },
  });
}

export async function createTask(data: z.infer<typeof taskSchema>) {
  return prisma.onboardingTask.create({ data });
}

export async function updateTask(id: string, data: z.infer<typeof taskSchema>) {
  const task = await prisma.onboardingTask.findUnique({ where: { id } });
  if (!task) throw new AppError(404, 'Onboarding task not found');
  return prisma.onboardingTask.update({ where: { id }, data });
}

export async function deleteTask(id: string) {
  const task = await prisma.onboardingTask.findUnique({ where: { id } });
  if (!task) throw new AppError(404, 'Onboarding task not found');
  return prisma.onboardingTask.update({ where: { id }, data: { active: false } });
}

// ---------- Assignments ----------

export async function generateAssignments(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AppError(404, 'Employee not found');
  const tasks = await prisma.onboardingTask.findMany({ where: { active: true }, orderBy: { orderIndex: 'asc' } });
  if (tasks.length === 0) return { created: 0, employeeId };

  const existing = await prisma.onboardingAssignment.findMany({
    where: { employeeId },
    select: { taskId: true },
  });
  const have = new Set(existing.map((a) => a.taskId));
  const rows = tasks.filter((t) => !have.has(t.id)).map((t) => ({ employeeId, taskId: t.id }));
  if (rows.length === 0) return { created: 0, employeeId };

  const result = await prisma.onboardingAssignment.createMany({ data: rows });
  return { created: result.count, employeeId };
}

export async function generateForAllActiveEmployees() {
  const employees = await prisma.employee.findMany({ where: { status: 'Active' }, select: { id: true } });
  let created = 0;
  for (const e of employees) {
    created += (await generateAssignments(e.id)).created;
  }
  return { created, employees: employees.length };
}

export async function listAssignments(query: { employeeId?: string; status?: string }) {
  const where: Record<string, unknown> = {};
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.status) where.status = query.status;
  return prisma.onboardingAssignment.findMany({
    where,
    include: { task: true, employee: { select: { id: true, name: true, email: true } } },
    orderBy: [{ employee: { name: 'asc' } }, { task: { orderIndex: 'asc' } }],
  });
}

export async function canManageAssignment(id: string, employeeId: string | null | undefined) {
  if (!employeeId) return false;
  const assignment = await prisma.onboardingAssignment.findUnique({ where: { id }, select: { employeeId: true } });
  return assignment?.employeeId === employeeId;
}

export async function setAssignmentStatus(id: string, data: z.infer<typeof statusSchema>, userId: string) {
  const assignment = await prisma.onboardingAssignment.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!assignment) throw new AppError(404, 'Onboarding assignment not found');
  const updated = await prisma.onboardingAssignment.update({
    where: { id },
    data: {
      status: data.status,
      notes: data.notes ?? assignment.notes,
      completedBy: data.status === 'COMPLETED' ? userId : assignment.completedBy,
      completedAt: data.status === 'COMPLETED' ? new Date() : assignment.completedAt,
    },
  });
  if (data.status === 'COMPLETED') {
    const remaining = await prisma.onboardingAssignment.count({
      where: { employeeId: assignment.employeeId, status: { not: 'COMPLETED' } },
    });
    if (remaining === 0) {
      await notifyRole(
        'HR',
        `Onboarding checklist completed for ${assignment.employee.name}`,
        'onboarding',
        '/onboarding',
      );
      await notifyRole(
        'Admin',
        `Onboarding checklist completed for ${assignment.employee.name}`,
        'onboarding',
        '/onboarding',
      );
    }
  }
  return updated;
}

export async function progressOverview() {
  const employees = await prisma.employee.findMany({
    where: { status: 'Active' },
    select: {
      id: true,
      name: true,
      email: true,
      department: { select: { name: true } },
      onboardingTasks: {
        select: { status: true },
      },
    },
    orderBy: { name: 'asc' },
  });
  return employees.map((e) => {
    const total = e.onboardingTasks.length;
    const done = e.onboardingTasks.filter((a) => a.status === 'COMPLETED').length;
    return {
      id: e.id,
      name: e.name,
      email: e.email,
      department: e.department?.name ?? null,
      total,
      completed: done,
      progress: total === 0 ? null : Math.round((done / total) * 100),
    };
  });
}