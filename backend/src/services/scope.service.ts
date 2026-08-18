import prisma from '../lib/prisma';

export async function getScopeEmployeeIds(employeeId: string | null | undefined): Promise<string[]> {
  if (!employeeId) return [];
  const reports = await prisma.employee.findMany({
    where: { reportsToId: employeeId },
    select: { id: true },
  });
  return [employeeId, ...reports.map((r) => r.id)];
}