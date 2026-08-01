import prisma from '../lib/prisma';

export async function getStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [totalEmployees, totalDepartments, pendingLeaves, todayAttendance, leaveTrend, attendanceTrend] =
    await Promise.all([
      prisma.employee.count({ where: { status: 'Active' } }),
      prisma.department.count(),
      prisma.leaveRequest.count({ where: { status: 'Pending' } }),
      prisma.attendance.count({ where: { date: { gte: today, lt: tomorrow } } }),
      prisma.leaveRequest.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.attendance.findMany({
        where: { date: { gte: new Date(new Date().setDate(today.getDate() - 30)) } },
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
