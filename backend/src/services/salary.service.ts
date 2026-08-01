import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';

export const createSalaryStructureSchema = z.object({
  employeeId: z.string().min(1),
  baseSalary: z.number().positive(),
  effectiveFrom: z.string().or(z.date()),
});

export const createSalaryComponentSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(['BONUS', 'INCENTIVE', 'DEDUCTION', 'ALLOWANCE']),
  label: z.string().min(1),
  amount: z.number(),
  isRecurring: z.boolean().optional(),
});

export const generatePayrollSchema = z.object({
  employeeIds: z.array(z.string().min(1)).optional(),
  departmentId: z.string().optional(),
  month: z.number().min(1).max(12),
  year: z.number(),
  allEmployees: z.boolean().optional(),
});

export const adjustPayrollSchema = z.object({
  adjustment: z.number(),
  adjustmentReason: z.string().min(1, 'Reason is required'),
});

export async function createOrUpdateSalaryStructure(data: z.infer<typeof createSalaryStructureSchema>) {
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw new AppError(404, 'Employee not found');

  const effectiveFrom = new Date(data.effectiveFrom);

  const latest = await prisma.salaryStructure.findFirst({
    where: { employeeId: data.employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (latest) {
    await prisma.salaryStructure.update({
      where: { id: latest.id },
      data: { effectiveTo: effectiveFrom },
    });
  }

  return prisma.salaryStructure.create({
    data: {
      employeeId: data.employeeId,
      baseSalary: data.baseSalary,
      effectiveFrom,
    },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

export async function getSalaryStructure(employeeId: string) {
  const structure = await prisma.salaryStructure.findFirst({
    where: { employeeId, effectiveTo: null },
    include: { employee: { select: { id: true, name: true, email: true, departmentId: true } } },
  });
  if (!structure) throw new AppError(404, 'No active salary structure found for this employee');
  return structure;
}

export async function getSalaryStructureHistory(employeeId: string) {
  return prisma.salaryStructure.findMany({
    where: { employeeId },
    orderBy: { effectiveFrom: 'desc' },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

export async function createSalaryComponent(data: z.infer<typeof createSalaryComponentSchema>) {
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throw new AppError(404, 'Employee not found');

  return prisma.salaryComponent.create({
    data: {
      employeeId: data.employeeId,
      type: data.type,
      label: data.label,
      amount: data.amount,
      isRecurring: data.isRecurring ?? false,
    },
  });
}

export async function getSalaryComponents(employeeId: string, activeOnly = true) {
  const where: any = { employeeId };
  if (activeOnly) where.endedAt = null;
  return prisma.salaryComponent.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export async function getAllActiveComponents() {
  return prisma.salaryComponent.findMany({
    where: { endedAt: null },
    include: { employee: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteSalaryComponent(id: string) {
  const component = await prisma.salaryComponent.findUnique({ where: { id } });
  if (!component) throw new AppError(404, 'Component not found');
  return prisma.salaryComponent.update({
    where: { id },
    data: { endedAt: new Date() },
  });
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export async function previewPayroll(employeeId: string, month: number, year: number) {
  const structure = await prisma.salaryStructure.findFirst({
    where: { employeeId, effectiveTo: null },
  });
  if (!structure) throw new AppError(400, 'No active salary structure');

  const daysInMonth = getDaysInMonth(month, year);
  const dailyRate = structure.baseSalary / daysInMonth;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const attendance = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: { gte: startDate, lte: endDate },
    },
  });

  const absentDays = attendance.filter((a) => a.status === 'Absent').length;
  const halfDays = attendance.filter((a) => a.status === 'HalfDay').length;
  const lateDays = attendance.filter((a) => {
    if (!a.checkIn) return false;
    const hour = a.checkIn.getHours();
    const minutes = a.checkIn.getMinutes();
    return hour > 9 || (hour === 9 && minutes > 15);
  }).length;

  const workingDays = attendance.length;
  const absentDayDeduction = absentDays * dailyRate;
  const halfDayDeduction = halfDays * dailyRate * 0.5;
  const lateDeduction = lateDays * dailyRate * 0.1;
  const attendanceDeduction = absentDayDeduction + halfDayDeduction + lateDeduction;

  const activeComponents = await prisma.salaryComponent.findMany({
    where: { employeeId, endedAt: null },
  });

  const incentives = activeComponents
    .filter((c) => c.type === 'INCENTIVE')
    .reduce((sum, c) => sum + c.amount, 0);
  const bonuses = activeComponents
    .filter((c) => c.type === 'BONUS')
    .reduce((sum, c) => sum + c.amount, 0);
  const allowances = activeComponents
    .filter((c) => c.type === 'ALLOWANCE')
    .reduce((sum, c) => sum + c.amount, 0);
  const manualDeductions = activeComponents
    .filter((c) => c.type === 'DEDUCTION')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalDeductions = attendanceDeduction + manualDeductions;
  const totalAdditions = incentives + bonuses + allowances;
  const netSalary = structure.baseSalary - totalDeductions + totalAdditions;

  return {
    employeeId,
    baseSalary: structure.baseSalary,
    daysInMonth,
    workingDays,
    absentDays,
    halfDays,
    lateDays,
    dailyRate,
    attendanceDeduction,
    manualDeductions,
    totalDeductions,
    incentives,
    bonuses,
    allowances,
    totalAdditions,
    netSalary: Math.round(netSalary * 100) / 100,
    components: activeComponents.map((c) => ({
      type: c.type,
      label: c.label,
      amount: c.amount,
    })),
  };
}

export async function generatePayroll(
  employeeIds: string[],
  month: number,
  year: number,
  generatedBy: string,
) {
  const results: any[] = [];

  for (const employeeId of employeeIds) {
    const existing = await prisma.payrollRecord.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
    });
    if (existing) {
      results.push({ employeeId, skipped: true, reason: 'Payroll already exists' });
      continue;
    }

    try {
      const preview = await previewPayroll(employeeId, month, year);

      const activeComponents = await prisma.salaryComponent.findMany({
        where: { employeeId, endedAt: null },
      });

      const record = await prisma.payrollRecord.create({
        data: {
          employeeId,
          month,
          year,
          baseSalary: preview.baseSalary,
          totalDeductions: preview.totalDeductions,
          totalIncentives: preview.incentives,
          totalBonuses: preview.bonuses,
          netSalary: preview.netSalary,
          status: 'DRAFT',
          generatedAt: new Date(),
          generatedBy,
          components: {
            create: activeComponents.map((c) => ({
              type: c.type,
              label: c.label,
              amount: c.amount,
            })),
          },
        },
        include: {
          employee: { select: { id: true, name: true, email: true, departmentId: true } },
          components: true,
        },
      });

      results.push({ employeeId, payrollRecordId: record.id, netSalary: record.netSalary });
    } catch (err: any) {
      results.push({ employeeId, error: err.message });
    }
  }

  return results;
}

export async function getPayrollRecord(employeeId: string, month: number, year: number) {
  const record = await prisma.payrollRecord.findUnique({
    where: { employeeId_month_year: { employeeId, month, year } },
    include: {
      employee: {
        select: { id: true, name: true, email: true, department: { select: { name: true } } },
      },
      components: true,
    },
  });
  if (!record) throw new AppError(404, 'Payroll record not found');
  return record;
}

export async function getPayrollRecordById(id: string) {
  const record = await prisma.payrollRecord.findUnique({
    where: { id },
    include: {
      employee: {
        select: { id: true, name: true, email: true, department: { select: { name: true } } },
      },
      components: true,
    },
  });
  if (!record) throw new AppError(404, 'Payroll record not found');
  return record;
}

export async function adjustPayroll(id: string, adjustment: number, reason: string) {
  const record = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!record) throw new AppError(404, 'Payroll record not found');
  if (record.status !== 'DRAFT') throw new AppError(400, 'Can only adjust DRAFT payroll records');

  const netSalary = Math.round((record.netSalary + adjustment) * 100) / 100;

  return prisma.payrollRecord.update({
    where: { id },
    data: {
      adjustment,
      adjustmentReason: reason,
      netSalary,
      status: 'DRAFT',
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      components: true,
    },
  });
}

export async function finalizePayroll(id: string, finalizedBy: string) {
  const record = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!record) throw new AppError(404, 'Payroll record not found');
  if (record.status !== 'DRAFT') throw new AppError(400, 'Payroll is not in DRAFT status');

  return prisma.payrollRecord.update({
    where: { id },
    data: {
      status: 'FINALIZED',
      finalizedAt: new Date(),
      finalizedBy,
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      components: true,
    },
  });
}

export async function getPayrollSummary(month: number, year: number) {
  const records = await prisma.payrollRecord.findMany({
    where: { month, year },
    include: {
      employee: {
        select: { id: true, name: true, departmentId: true, department: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalPayroll = records.reduce((sum, r) => sum + r.netSalary, 0);
  const totalBaseSalary = records.reduce((sum, r) => sum + r.baseSalary, 0);
  const totalDeductions = records.reduce((sum, r) => sum + r.totalDeductions, 0);
  const totalIncentives = records.reduce((sum, r) => sum + r.totalIncentives, 0);
  const totalBonuses = records.reduce((sum, r) => sum + r.totalBonuses, 0);

  const deptBreakdown: Record<string, { total: number; count: number; baseTotal: number }> = {};
  for (const r of records) {
    const deptName = r.employee.department?.name || 'Unassigned';
    if (!deptBreakdown[deptName]) deptBreakdown[deptName] = { total: 0, count: 0, baseTotal: 0 };
    deptBreakdown[deptName].total += r.netSalary;
    deptBreakdown[deptName].count += 1;
    deptBreakdown[deptName].baseTotal += r.baseSalary;
  }

  const avgSalary = records.length > 0 ? totalPayroll / records.length : 0;

  const finishedCount = records.filter((r) => r.status !== 'DRAFT').length;
  const draftCount = records.filter((r) => r.status === 'DRAFT').length;

  return {
    totalPayroll: Math.round(totalPayroll * 100) / 100,
    totalBaseSalary: Math.round(totalBaseSalary * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    totalIncentives: Math.round(totalIncentives * 100) / 100,
    totalBonuses: Math.round(totalBonuses * 100) / 100,
    avgSalary: Math.round(avgSalary * 100) / 100,
    employeeCount: records.length,
    finishedCount,
    draftCount,
    deptBreakdown: Object.entries(deptBreakdown).map(([name, data]) => ({
      name,
      total: Math.round(data.total * 100) / 100,
      baseTotal: Math.round(data.baseTotal * 100) / 100,
      count: data.count,
    })),
    records,
  };
}

export async function listPayrollRecords(month?: number, year?: number, employeeId?: string) {
  const where: any = {};
  if (month) where.month = month;
  if (year) where.year = year;
  if (employeeId) where.employeeId = employeeId;

  return prisma.payrollRecord.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, department: { select: { name: true } } } },
      components: true,
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { name: 'asc' } }],
  });
}

export async function getAllSalaryStructures() {
  return prisma.salaryStructure.findMany({
    where: { effectiveTo: null },
    include: {
      employee: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
    },
    orderBy: { employee: { name: 'asc' } },
  });
}

export async function getPayrollTrend() {
  const records = await prisma.payrollRecord.findMany({
    where: { status: { not: 'DRAFT' } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  const monthlyMap: Record<string, { totalNet: number; count: number; totalBase: number }> = {};
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    if (!monthlyMap[key]) monthlyMap[key] = { totalNet: 0, count: 0, totalBase: 0 };
    monthlyMap[key].totalNet += r.netSalary;
    monthlyMap[key].count += 1;
    monthlyMap[key].totalBase += r.baseSalary;
  }

  return Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      totalPayroll: Math.round(data.totalNet * 100) / 100,
      employeeCount: data.count,
      avgSalary: Math.round((data.totalNet / data.count) * 100) / 100,
      totalBase: Math.round(data.totalBase * 100) / 100,
    }));
}

export async function getAllEmployees() {
  return prisma.employee.findMany({
    where: { status: 'Active' },
    include: { department: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
}
