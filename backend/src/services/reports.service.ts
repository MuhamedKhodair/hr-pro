import prisma from '../lib/prisma';

export async function leaveSummary(month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const requests = await prisma.leaveRequest.findMany({
    where: {
      isCancelled: false,
      startDate: { gte: start, lt: end },
    },
    include: { employee: { select: { departmentId: true } } },
  });

  const approved = requests.filter((r) => r.status === 'Approved');
  const byType = new Map<string, { type: string; count: number; days: number }>();
  for (const r of approved) {
    const entry = byType.get(r.type) ?? { type: r.type, count: 0, days: 0 };
    entry.count += 1;
    entry.days += r.totalDays;
    byType.set(r.type, entry);
  }

  return {
    month,
    year,
    requested: requests.length,
    pending: requests.filter((r) => r.status === 'Pending').length,
    approvedCount: approved.length,
    approvedDays: approved.reduce((sum, r) => sum + r.totalDays, 0),
    byType: [...byType.values()].sort((a, b) => b.days - a.days),
  };
}

export async function attendanceSummary(month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const records = await prisma.attendance.findMany({
    where: { date: { gte: start, lt: end } },
    include: {
      employee: {
        select: { name: true, department: { select: { name: true } } },
      },
    },
    orderBy: { employee: { name: 'asc' } },
  });

  const byEmployee = new Map<string, {
    employeeId: string;
    name: string;
    department: string | null;
    present: number;
    absent: number;
    halfDay: number;
    overtimeHrs: number;
  }>();

  for (const r of records) {
    const key = r.employeeId;
    const entry = byEmployee.get(key) ?? {
      employeeId: key,
      name: r.employee.name,
      department: r.employee.department?.name ?? null,
      present: 0,
      absent: 0,
      halfDay: 0,
      overtimeHrs: 0,
    };
    if (r.status === 'Present') entry.present += 1;
    else if (r.status === 'Absent') entry.absent += 1;
    else entry.halfDay += 1;
    entry.overtimeHrs += r.overtimeHrs;
    byEmployee.set(key, entry);
  }

  const rows = [...byEmployee.values()];
  return {
    month,
    year,
    employees: rows.length,
    present: rows.reduce((s, r) => s + r.present, 0),
    absent: rows.reduce((s, r) => s + r.absent, 0),
    halfDay: rows.reduce((s, r) => s + r.halfDay, 0),
    overtimeHrs: rows.reduce((s, r) => s + r.overtimeHrs, 0),
    rows,
  };
}

export async function headcountReport() {
  const departments = await prisma.department.findMany({
    include: {
      employees: {
        select: { status: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const rows = departments.map((d) => ({
    department: d.name,
    total: d.employees.length,
    active: d.employees.filter((e) => e.status === 'Active').length,
    inactive: d.employees.filter((e) => e.status === 'Inactive').length,
    terminated: d.employees.filter((e) => e.status === 'Terminated').length,
  }));

  const unassigned = await prisma.employee.findMany({
    where: { departmentId: null },
    select: { status: true },
  });

  return {
    departments: rows,
    unassigned: {
      total: unassigned.length,
      active: unassigned.filter((e) => e.status === 'Active').length,
      inactive: unassigned.filter((e) => e.status === 'Inactive').length,
      terminated: unassigned.filter((e) => e.status === 'Terminated').length,
    },
  };
}

export function leaveSummaryCsv(summary: Awaited<ReturnType<typeof leaveSummary>>) {
  const lines = [
    ['Leave Type', 'Requests', 'Days'],
    ...summary.byType.map((t) => [t.type, String(t.count), String(t.days)]),
    [],
    ['Total requested', String(summary.requested), ''],
    ['Pending', String(summary.pending), ''],
    ['Approved', String(summary.approvedCount), String(summary.approvedDays)],
  ];
  return lines.map((l) => l.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function attendanceSummaryCsv(summary: Awaited<ReturnType<typeof attendanceSummary>>) {
  const lines = [
    ['Employee', 'Department', 'Present', 'Absent', 'Half Day', 'Overtime Hours'],
    ...summary.rows.map((r) => [r.name, r.department ?? '', String(r.present), String(r.absent), String(r.halfDay), String(r.overtimeHrs)]),
    [],
    ['Totals', '', String(summary.present), String(summary.absent), String(summary.halfDay), String(summary.overtimeHrs)],
  ];
  return lines.map((l) => l.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function headcountCsv(report: Awaited<ReturnType<typeof headcountReport>>) {
  const lines = [
    ['Department', 'Total', 'Active', 'Inactive', 'Terminated'],
    ...report.departments.map((d) => [d.department, String(d.total), String(d.active), String(d.inactive), String(d.terminated)]),
    ['Unassigned', String(report.unassigned.total), String(report.unassigned.active), String(report.unassigned.inactive), String(report.unassigned.terminated)],
  ];
  return lines.map((l) => l.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}