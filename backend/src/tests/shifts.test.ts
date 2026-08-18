import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;

before(async () => {
  env = await startTestEnv('test-shifts.db');
  const dept = await env.prisma.department.create({ data: { name: 'Engineering' } });
  await env.prisma.employee.createMany({
    data: [
      { name: 'Shift A', email: 'shifta@hrpro.com', position: 'Dev', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
      { name: 'Shift B', email: 'shiftb@hrpro.com', position: 'Dev', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
      { name: 'Shift C', email: 'shiftc@hrpro.com', position: 'Dev', departmentId: null, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
    ],
  });
  await env.prisma.shift.createMany({
    data: [
      { name: 'Morning', startTime: '08:00', endTime: '16:00' },
      { name: 'Evening', startTime: '16:00', endTime: '00:00' },
    ],
  });
  const pwd = await hashPassword('admin123');
  await env.prisma.user.create({
    data: { email: 'alice@hrpro.com', password: pwd, role: 'Admin' },
  });
});

after(async () => {
  await env.close();
});

describe('shift rota', () => {
  test('assign, list, unassign employees on a shift', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const token = admin.accessToken;
    const shift = (await env.prisma.shift.findFirst())!;
    const [a, b] = await env.prisma.employee.findMany({ orderBy: { name: 'asc' } });

    // Unassigned list only includes active employees with a department
    const unassigned = await env.request('GET', '/api/shifts/unassigned', { token });
    assert.equal(unassigned.status, 200);
    const names = unassigned.json.data.map((e: any) => e.name).sort();
    assert.deepEqual(names, ['Shift A', 'Shift B']);

    // Bulk assign
    const assigned = await env.request('POST', `/api/shifts/${shift.id}/assign`, {
      token,
      body: { employeeIds: [a.id, b.id] },
    });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.json));
    assert.equal(assigned.json.data._count.employees, 2);

    // Shift employees list
    const list = await env.request('GET', `/api/shifts/${shift.id}/employees`, { token });
    assert.equal(list.status, 200);
    assert.equal(list.json.data.length, 2);
    assert.ok(list.json.data.some((e: any) => e.id === a.id));

    // Deletion of assigned shift is blocked
    const del = await env.request('DELETE', `/api/shifts/${shift.id}`, { token });
    assert.equal(del.status, 400);

    // Unassign one
    const unassign = await env.request('DELETE', `/api/shifts/${shift.id}/employees/${a.id}`, { token });
    assert.equal(unassign.status, 200);
    const after = await env.request('GET', `/api/shifts/${shift.id}/employees`, { token });
    assert.equal(after.json.data.length, 1);

    // Unassign the rest, then the shift can be deleted
    const unassignB = await env.request('DELETE', `/api/shifts/${shift.id}/employees/${b.id}`, { token });
    assert.equal(unassignB.status, 200);
    const del2 = await env.request('DELETE', `/api/shifts/${shift.id}`, { token });
    assert.equal(del2.status, 200);
  });

  test('employees cannot manage the rota', async () => {
    const a = (await env.prisma.employee.findFirst())!;
    const pwd = await hashPassword('shift123');
    await env.prisma.user.create({ data: { email: 'sh.Employee@hrpro.com', password: pwd, role: 'Employee', employeeId: a.id } });
    const login = await loginAs(env, 'sh.Employee@hrpro.com', 'shift123');
    const shift = (await env.prisma.shift.findFirst())!;
    const res = await env.request('GET', `/api/shifts/${shift.id}/employees`, { token: login.accessToken });
    assert.equal(res.status, 403);
  });

  test('employees can fetch their own shift schedule', async () => {
    const a = (await env.prisma.employee.findFirst())!;
    const login = await loginAs(env, 'sh.Employee@hrpro.com', 'shift123');

    const none = await env.request('GET', '/api/shifts/mine', { token: login.accessToken });
    assert.equal(none.status, 200);
    assert.equal(none.json.data, null);

    const shift = (await env.prisma.shift.findFirst())!;
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    await env.request('POST', `/api/shifts/${shift.id}/assign`, {
      token: admin.accessToken,
      body: { employeeIds: [a.id] },
    });

    const mine = await env.request('GET', '/api/shifts/mine', { token: login.accessToken });
    assert.equal(mine.status, 200);
    assert.equal(mine.json.data.id, shift.id);
    assert.equal(mine.json.data.name, shift.name);
    assert.equal(mine.json.data.startTime, shift.startTime);
    assert.equal(mine.json.data.endTime, shift.endTime);
  });
});