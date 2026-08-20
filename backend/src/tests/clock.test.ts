import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;

before(async () => {
  env = await startTestEnv('test-clock.db');
  const dept = await env.prisma.department.create({ data: { name: 'Ops' } });
  const [emp, emp2] = await Promise.all([
    env.prisma.employee.create({
      data: { name: 'Clock Tester', email: 'clock@hrpro.com', position: 'Clerk', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
    }),
    env.prisma.employee.create({
      data: { name: 'Self Emp', email: 'self@hrpro.com', position: 'Clerk', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
    }),
  ]);
  const pwd = await hashPassword('admin123');
  await env.prisma.user.createMany({
    data: [
      { email: 'alice@hrpro.com', password: pwd, role: 'Admin' },
      { email: 'clock@hrpro.com', password: pwd, role: 'Employee' },
      { email: 'self@hrpro.com', password: pwd, role: 'Employee' },
    ],
  });
  await env.prisma.user.update({ where: { email: 'clock@hrpro.com' }, data: { employeeId: emp.id } });
  await env.prisma.user.update({ where: { email: 'self@hrpro.com' }, data: { employeeId: emp2.id } });
});

after(async () => {
  await env.close();
});

describe('quick clock (self check-in/check-out)', () => {
  test('employee can check in and out without sending employeeId', async () => {
    const emp = await loginAs(env, 'clock@hrpro.com', 'admin123');
    const token = emp.accessToken;

    const checkIn = await env.request('POST', '/api/attendance/check-in', { token, body: {} });
    assert.equal(checkIn.status, 201, JSON.stringify(checkIn.json));
    assert.ok(checkIn.json.data.checkIn);

    const checkOut = await env.request('POST', '/api/attendance/check-out', { token, body: {} });
    assert.equal(checkOut.status, 200, JSON.stringify(checkOut.json));
    assert.ok(checkOut.json.data.checkOut);

    const today = await env.request('GET', '/api/attendance/today', { token });
    assert.equal(today.status, 200);
    assert.equal(today.json.data.length, 1);
    assert.ok(today.json.data[0].checkIn);
    assert.ok(today.json.data[0].checkOut);
  });

  test('employee cannot force check-in for another employee', async () => {
    const emp = await loginAs(env, 'self@hrpro.com', 'admin123');
    const token = emp.accessToken;
    const adminEmp = (await env.prisma.employee.create({
      data: { name: 'Other Emp', email: 'other@hrpro.com', position: 'Clerk', hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
    }));

    const res = await env.request('POST', '/api/attendance/check-in', { token, body: { employeeId: adminEmp.id } });
    assert.equal(res.status, 201);
    assert.notEqual(res.json.data.employeeId, adminEmp.id);
    assert.equal(res.json.data.employeeId, (await env.prisma.user.findUnique({ where: { email: 'self@hrpro.com' } }))!.employeeId);
  });

  test('admin check-in still requires employeeId', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const res = await env.request('POST', '/api/attendance/check-in', { token: admin.accessToken, body: {} });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /employeeId/);
  });
});