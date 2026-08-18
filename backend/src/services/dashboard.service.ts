import prisma from '../lib/prisma';

function scopeFilter(scope?: string[]) {
  return scope ? { id: { in: scope } } : {};
}

function employeeIdFilter(scope?: string[]) {
  return scope ? { employeeId: { in: scope } } : {};
}

export async function getStats(scope?: string[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [totalEmployees, totalDepartments, pendingLeaves, todayAttendance, leaveTrend, attendanceTrend] =
    await Promise.all([
      prisma.employee.count({ where: { status: 'Active', ...scopeFilter(scope) } }),
      scope ? Promise.resolve(0) : prisma.department.count(),
      prisma.leaveRequest.count({ where: { status: 'Pending', isCancelled: false, ...employeeIdFilter(scope) } }),
      prisma.attendance.count({ where: { date: { gte: today, lt: tomorrow }, ...employeeIdFilter(scope) } }),
      prisma.leaveRequest.groupBy({
        by: ['status'],
        where: { isCancelled: false, ...employeeIdFilter(scope) },
        _count: true,
      }),
      prisma.attendance.findMany({
        where: { date: { gte: new Date(new Date().setDate(today.getDate() - 30)) }, ...employeeIdFilter(scope) },
        select: { date: true, status: true },
        orderBy: { date: 'asc' },
      }),
    ]);

  return {
    totalEmployees,
    totalDepartments,
    pendingLeaves,
    todayAttendance,
    leaveTrend,
    attendanceTrend,
  };
}

export async function getDepartmentHeadcount(scope?: string[]) {
  const departments = await prisma.department.findMany({
    include: {
      _count: { select: { employees: { where: { status: 'Active', ...scopeFilter(scope) } } } },
    },
  });
  if (scope) {
    const inScope = await prisma.employee.count({ where: { status: 'Active', id: { in: scope } } });
    const assigned = departments.reduce((sum, d) => sum + d._count.employees, 0);
    return { byDepartment: departments.filter((d) => d._count.employees > 0).map((d) => ({ name: d.name, count: d._count.employees })), unassigned: Math.max(0, inScope - assigned) };
  }
  const unassigned = await prisma.employee.count({
    where: { departmentId: null, status: 'Active' },
  });
  return {
    byDepartment: departments.map((d) => ({ name: d.name, count: d._count.employees })),
    unassigned,
  };
}

export async function getUpcomingBirthdays(days = 30, scope?: string[]) {
  const employees = await prisma.employee.findMany({
    where: { status: 'Active', birthDate: { not: null }, ...scopeFilter(scope) },
    select: { id: true, name: true, birthDate: true, department: { select: { name: true } } },
  });

  const now = new Date();
  const upcoming: { id: string; name: string; department: string; date: string; daysUntil: number }[] = [];

  for (const e of employees) {
    const bd = e.birthDate!;
    const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    const target = thisYear < now ? new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate()) : thisYear;
    const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
    if (diff <= days) {
      upcoming.push({
        id: e.id,
        name: e.name,
        department: e.department?.name ?? '—',
        date: target.toISOString().split('T')[0],
        daysUntil: diff,
      });
    }
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function getUpcomingAnniversaries(days = 30, scope?: string[]) {
  const employees = await prisma.employee.findMany({
    where: { status: 'Active', ...scopeFilter(scope) },
    select: { id: true, name: true, hireDate: true, department: { select: { name: true } } },
  });

  const now = new Date();
  const upcoming: { id: string; name: string; department: string; years: number; date: string; daysUntil: number }[] = [];

  for (const e of employees) {
    const hd = new Date(e.hireDate);
    const thisYear = new Date(now.getFullYear(), hd.getMonth(), hd.getDate());
    const target = thisYear < now ? new Date(now.getFullYear() + 1, hd.getMonth(), hd.getDate()) : thisYear;
    const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
    const years = target.getFullYear() - hd.getFullYear();
    if (diff <= days && years > 0) {
      upcoming.push({
        id: e.id,
        name: e.name,
        department: e.department?.name ?? '—',
        date: target.toISOString().split('T')[0],
        years,
        daysUntil: diff,
      });
    }
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function getRecentActivity(limit = 10, scope?: string[]) {
  const [recentLeaves, recentCheckins, recentEmployees] = await Promise.all([
    prisma.leaveRequest.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: scope ? { employeeId: { in: scope } } : undefined,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        employee: { select: { name: true } },
      },
    }),
    prisma.attendance.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: { checkIn: { not: null }, ...(scope ? { employeeId: { in: scope } } : {}) },
      select: { id: true, checkIn: true, createdAt: true, employee: { select: { name: true } } },
    }),
    prisma.employee.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: scope ? { id: { in: scope } } : undefined,
      select: { id: true, name: true, position: true, createdAt: true },
    }),
  ]);

  type Activity = {
    type: 'leave' | 'checkin' | 'employee_added';
    message: string;
    at: string;
  };

  const activities: Activity[] = [
    ...recentLeaves.map((l) => ({
      type: 'leave' as const,
      message: `${l.employee.name} submitted a ${l.type} leave request (${l.status})`,
      at: l.createdAt.toISOString(),
    })),
    ...recentCheckins.map((a) => ({
      type: 'checkin' as const,
      message: `${a.employee.name} checked in`,
      at: (a.checkIn ?? a.createdAt).toISOString(),
    })),
    ...recentEmployees.map((e) => ({
      type: 'employee_added' as const,
      message: `${e.name} joined as ${e.position}`,
      at: e.createdAt.toISOString(),
    })),
  ];

  return activities
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
