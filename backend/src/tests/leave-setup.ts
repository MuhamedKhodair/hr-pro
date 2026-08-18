import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

export async function setupAdminAndEmployee(env: TestEnv) {
  const dept = await env.prisma.department.create({ data: { name: 'Ops' } });
  const emp = await env.prisma.employee.create({
    data: { name: 'Alice Emp', email: 'alice.emp@hrpro.com', position: 'Dev', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 5000 },
  });
  const pwd = await hashPassword('admin123');
  await env.prisma.user.create({ data: { email: 'alice@hrpro.com', password: pwd, role: 'Admin' } });
  const plainEmp = await env.prisma.employee.create({
    data: { name: 'Bob', email: 'bob@hrpro.com', position: 'QA', departmentId: dept.id, hireDate: new Date('2025-02-01'), status: 'Active', salary: 3000 },
  });
  const plainPwd = await hashPassword('bobpass1');
  await env.prisma.user.create({ data: { email: 'bob.login@hrpro.com', password: plainPwd, role: 'Employee', employeeId: plainEmp.id } });
  const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
  const plain = await loginAs(env, 'bob.login@hrpro.com', 'bobpass1');
  return { admin, plain, empId: emp.id };
}
