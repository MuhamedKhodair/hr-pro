import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;

before(async () => {
  env = await startTestEnv('test-clock.db');
  const dept = await env.prisma.department.create({ data: { name: 'Ops' } });
  const [emp, emp2, adminEmp] = await Promise.all([
    env.prisma.employee.create({
      data: { name: 'Clock Tester', email: 'clock@hrpro.com', position: 'Clerk', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
    }),
    env.prisma.employee.create({
      data: { name: 'Self Emp', email: 'self@hrpro.com', position: 'Clerk', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
    }),
    env.prisma.employee.create({
      data: { name: 'Alice Admin', email: 'alice@hrpro.com', position: 'Manager', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 3000 },
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
  await env.prisma.user.update({ where: { email: 'alice@hrpro.com' }, data: { employeeId: adminEmp.id } });
});

after(async () => {
  await env.close();
});

describe('quick clock (self check-in/check-out)', () => {
  test('employee can check in and out without sending employeeId', async () => {
    const emp = await loginAs(env, 'clock@hrpro.com', 'admin123');
    const token = emp.accessToken;

    const checkIn = await env.request('POST', '/api/attendance/check-in', {
      token,
      body: { latitude: 30.0444, longitude: 31.2357, accuracy: 8 },
    });
    assert.equal(checkIn.status, 201, JSON.stringify(checkIn.json));
    assert.ok(checkIn.json.data.checkIn);
    assert.equal(checkIn.json.data.latitude, 30.0444);
    assert.equal(checkIn.json.data.longitude, 31.2357);
    assert.equal(checkIn.json.data.accuracy, 8);

    const checkOut = await env.request('POST', '/api/attendance/check-out', { token, body: {} });
    assert.equal(checkOut.status, 200, JSON.stringify(checkOut.json));
    assert.ok(checkOut.json.data.checkOut);

    const today = await env.request('GET', '/api/attendance/today', { token });
    assert.equal(today.status, 200);
    assert.equal(today.json.data.length, 1);
    assert.ok(today.json.data[0].checkIn);
    assert.ok(today.json.data[0].checkOut);
    assert.equal(today.json.data[0].latitude, 30.0444);
    assert.equal(today.json.data[0].longitude, 31.2357);
    assert.equal(today.json.data[0].accuracy, 8);
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

  test('admin check-in still requires employeeId when not self', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const res = await env.request('POST', '/api/attendance/check-in', { token: admin.accessToken, body: {} });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /employeeId/);
  });

  test('admin with a linked profile can self check-in and sees only their record on ?self=1', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const aliceId = (await env.prisma.user.findUnique({ where: { email: 'alice@hrpro.com' } }))!.employeeId!;

    const checkIn = await env.request('POST', '/api/attendance/check-in', {
      token: admin.accessToken,
      body: { self: true, latitude: 30.0445, longitude: 31.2358, accuracy: 9 },
    });
    assert.equal(checkIn.status, 201, JSON.stringify(checkIn.json));
    assert.equal(checkIn.json.data.employeeId, aliceId);

    const self = await env.request('GET', '/api/attendance/today?self=1', { token: admin.accessToken });
    assert.equal(self.status, 200);
    assert.ok(self.json.data.length >= 1);
    assert.ok(self.json.data.every((r: any) => r.employeeId === aliceId));

    const checkOut = await env.request('POST', '/api/attendance/check-out', {
      token: admin.accessToken,
      body: { self: true },
    });
    assert.equal(checkOut.status, 200, JSON.stringify(checkOut.json));
    assert.equal(checkOut.json.data.employeeId, aliceId);
    assert.ok(checkOut.json.data.checkOut);
  });

  test('admin without a linked profile gets 400 (no self clock-in possible)', async () => {
    const pwd = await hashPassword('admin123');
    await env.prisma.user.create({ data: { email: 'orphan@hrpro.com', password: pwd, role: 'Admin' } });
    const orphan = await loginAs(env, 'orphan@hrpro.com', 'admin123');

    const res = await env.request('POST', '/api/attendance/check-in', {
      token: orphan.accessToken,
      body: { self: true },
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /employeeId is required/);

    const today = await env.request('GET', '/api/attendance/today?self=1', { token: orphan.accessToken });
    assert.equal(today.status, 200);
    assert.deepEqual(today.json.data, []);
  });

  test('getDateRange ?self=1 scopes to the caller for every role', async () => {
    for (const email of ['clock@hrpro.com', 'alice@hrpro.com']) {
      const { accessToken } = await loginAs(env, email, 'admin123');
      const me = (await env.prisma.user.findUnique({ where: { email } }))!.employeeId!;
      const today = new Date().toISOString().slice(0, 10);
      const res = await env.request('GET', `/api/attendance/range?start=${today}&end=${today}&self=1`, {
        token: accessToken,
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.json.data));
      assert.ok(res.json.data.every((r: any) => r.employeeId === me), `${email} saw other employees: ${res.json.data.length}`);
    }
  });

  test('employee without a linked profile sees no one else\'s attendance', async () => {
    const pwd = await hashPassword('admin123');
    await env.prisma.user.create({ data: { email: 'ghost@hrpro.com', password: pwd, role: 'Employee' } });
    const ghost = await loginAs(env, 'ghost@hrpro.com', 'admin123');

    const today = await env.request('GET', '/api/attendance/today', { token: ghost.accessToken });
    assert.equal(today.status, 200);
    assert.deepEqual(today.json.data, []);

    const checkIn = await env.request('POST', '/api/attendance/check-in', { token: ghost.accessToken, body: {} });
    assert.equal(checkIn.status, 400);
    assert.match(checkIn.json.error, /employeeId/);
  });
});