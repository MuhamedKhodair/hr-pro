import prisma from '../lib/prisma';
import { JwtPayload } from '../types';

export async function search(q: string, user: JwtPayload) {
  const term = q.trim();
  if (!term) return { employees: [], departments: [], leaves: [] };

  const isManager = user.role === 'Admin' || user.role === 'HR';

  const employeeWhere = {
    OR: [
      { name: { contains: term } },
      { email: { contains: term } },
      { position: { contains: term } },
      { department: { name: { contains: term } } },
    ],
  };

  const [employees, departments, leaves] = await Promise.all([
    prisma.employee.findMany({
      where: {
        AND: [employeeWhere, ...(isManager || !user.employeeId ? [] : [{ id: user.employeeId }])],
      },
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        status: true,
        department: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: {
        name: { contains: term },
        ...(isManager || !user.employeeId
          ? {}
          : { employees: { some: { id: user.employeeId } } }),
      },
      take: 5,
      select: { id: true, name: true, _count: { select: { employees: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        ...(isManager
          ? {
              OR: [
                { employee: { name: { contains: term } } },
                { employee: { email: { contains: term } } },
                { type: { contains: term } },
              ],
            }
          : { employeeId: user.employeeId ?? '__none__' }),
      },
      take: 8,
      select: {
        id: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        employee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { employees, departments, leaves };
}
