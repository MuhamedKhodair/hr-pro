import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';

export const CRITERIA_LABELS = [
  'Quality of Work',
  'Productivity',
  'Teamwork',
  'Communication',
  'Attendance & Punctuality',
  'Initiative',
];

export const criterionSchema = z.object({
  label: z.string().min(1).max(80),
  score: z.number().int().min(1).max(5),
});

export const reviewSchema = z.object({
  employeeId: z.string().min(1),
  reviewerId: z.string().optional().nullable(),
  periodName: z.string().min(1).max(60),
  criteria: z.array(criterionSchema).min(1),
  strengths: z.string().max(2000).optional().default(''),
  improvements: z.string().max(2000).optional().default(''),
  goals: z.string().max(2000).optional().default(''),
});

export const completeSchema = z.object({
  reviewComment: z.string().max(2000).optional().default(''),
});

function computeOverall(criteria: { score: number }[]) {
  if (criteria.length === 0) return 0;
  const sum = criteria.reduce((acc, c) => acc + c.score, 0);
  return Math.round((sum / criteria.length) * 10) / 10;
}

const reviewInclude = {
  employee: { include: { department: true } },
  reviewer: { include: { department: true } },
} as const;

function toDto(r: any) {
  let criteria: { label: string; score: number }[];
  try {
    criteria = JSON.parse(r.criteriaScores || '[]');
  } catch {
    criteria = [];
  }
  return {
    ...r,
    criteriaScores: undefined,
    criteria,
    overallScore: r.overallScore,
    employee: r.employee
      ? {
          id: r.employee.id,
          name: r.employee.name,
          email: r.employee.email,
          department: r.employee.department?.name ?? null,
        }
      : null,
    reviewer: r.reviewer
      ? { id: r.reviewer.id, name: r.reviewer.name, email: r.reviewer.email }
      : null,
  };
}

export async function listReviews(params: { periodName?: string; status?: string; employeeId?: string }) {
  const where: Record<string, unknown> = {};
  if (params.periodName) where.periodName = params.periodName;
  if (params.status) where.status = params.status;
  if (params.employeeId) where.employeeId = params.employeeId;
  const rows = await prisma.performanceReview.findMany({
    where,
    include: reviewInclude,
    orderBy: [{ createdAt: 'desc' }],
  });
  return rows.map(toDto);
}

export async function getReview(id: string) {
  const row = await prisma.performanceReview.findUnique({ where: { id }, include: reviewInclude });
  return row ? toDto(row) : null;
}

export async function createReview(data: z.infer<typeof reviewSchema>, userId: string | undefined) {
  const row = await prisma.performanceReview.create({
    data: {
      employeeId: data.employeeId,
      reviewerId: data.reviewerId || null,
      periodName: data.periodName,
      criteriaScores: JSON.stringify(data.criteria),
      overallScore: computeOverall(data.criteria),
      strengths: data.strengths ?? '',
      improvements: data.improvements ?? '',
      goals: data.goals ?? '',
      completedBy: undefined,
    },
    include: reviewInclude,
  });
  return toDto(row);
}

export async function updateReview(
  id: string,
  data: z.infer<typeof reviewSchema>,
  userId: string | undefined,
) {
  const existing = await prisma.performanceReview.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.status === 'COMPLETED') {
    throw new AppError(400, 'Completed reviews cannot be edited');
  }
  const row = await prisma.performanceReview.update({
    where: { id },
    data: {
      employeeId: data.employeeId,
      reviewerId: data.reviewerId || null,
      periodName: data.periodName,
      criteriaScores: JSON.stringify(data.criteria),
      overallScore: computeOverall(data.criteria),
      strengths: data.strengths ?? '',
      improvements: data.improvements ?? '',
      goals: data.goals ?? '',
    },
    include: reviewInclude,
  });
  return toDto(row);
}

export async function completeReview(id: string, comment: string, userId: string | undefined) {
  const existing = await prisma.performanceReview.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.performanceReview.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      reviewComment: comment,
      completedAt: new Date(),
      completedBy: userId ?? null,
    },
    include: reviewInclude,
  });
  return toDto(row);
}

export async function removeReview(id: string) {
  const existing = await prisma.performanceReview.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.performanceReview.delete({ where: { id } });
  return true;
}

export async function getStats() {
  const [all, completed, drafts, employeeCount, deptRows] = await Promise.all([
    prisma.performanceReview.findMany({ select: { overallScore: true, employee: { select: { department: { select: { name: true } } } } } }),
    prisma.performanceReview.count({ where: { status: 'COMPLETED' } }),
    prisma.performanceReview.count({ where: { status: 'DRAFT' } }),
    prisma.employee.count({ where: { status: 'Active' } }),
    prisma.performanceReview.findMany({
      select: {
        overallScore: true,
        employee: { select: { department: { select: { name: true } } } },
      },
    }),
  ]);

  const byDepartment: Record<string, { total: number; count: number }> = {};
  deptRows.forEach((r) => {
    const name = r.employee.department?.name ?? 'Unassigned';
    byDepartment[name] = byDepartment[name] || { total: 0, count: 0 };
    byDepartment[name].total += r.overallScore;
    byDepartment[name].count += 1;
  });
  const deptBreakdown = Object.entries(byDepartment).map(([name, v]) => ({
    name,
    average: v.count ? Math.round((v.total / v.count) * 10) / 10 : 0,
  }));

  const distribution = [1, 2, 3, 4, 5].map((star) => ({
    range: `${star === 1 ? '0' : star === 5 ? '4.5' : `${star}.5`}-${star === 5 ? '5' : `${star + 1}.4`}`,
    label: `${star}★`,
    count: all.filter((r) => star === 5 ? r.overallScore >= 4.5 : r.overallScore >= star + 0.5 - 1 && r.overallScore < star + 0.5).length,
  }));

  const avg = all.length ? all.reduce((acc, r) => acc + r.overallScore, 0) / all.length : 0;

  return {
    total: all.length,
    completed,
    drafts,
    employeeCount,
    average: Math.round(avg * 10) / 10,
    byDepartment: deptBreakdown,
    distribution,
  };
}

export async function getPeriods() {
  const rows = await prisma.performanceReview.findMany({
    select: { periodName: true },
    distinct: ['periodName'],
    orderBy: { periodName: 'desc' },
  });
  return rows.map((r) => r.periodName);
}

export async function getDefaultCriteria() {
  return CRITERIA_LABELS.map((label) => ({ label, score: 3 }));
}