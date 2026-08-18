import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;

before(async () => {
  env = await startTestEnv('test-reports.db');
  const dept = await env.prisma.department.create({ data: { name: 'Engineering' } });
  await env.prisma.employee.create({
    data: {
      name: 'Reporter',
      email: 'reporter@hrpro.com',
      position: 'Dev',
      departmentId: dept.id,
      hireDate: new Date('2025-01-01'),
      status: 'Active',
      salary: 1000,
    },
  });
  const pwd = await hashPassword('admin123');
  await env.prisma.user.create({
    data: { email: 'alice@hrpro.com', password: pwd, role: 'Admin' },
  });
});

after(async () => {
  await env.close();
});

describe('reports', () => {
  test('leave, attendance and headcount summaries return aggregates', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const token = admin.accessToken;
    const emp = (await env.prisma.employee.findFirst())!;

    await env.prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        type: 'Annual',
        startDate: new Date('2026-08-05'),
        endDate: new Date('2026-08-07'),
        totalDays: 3,
        reason: 'Vacation',
        status: 'Approved',
      },
    });
    await env.prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        type: 'Sick',
        startDate: new Date('2026-08-20'),
        endDate: new Date('2026-08-21'),
        totalDays: 2,
        reason: 'Flu',
        status: 'Pending',
      },
    });

    const leave = await env.request('GET', '/api/reports/leave-summary?month=8&year=2026', { token });
    assert.equal(leave.status, 200);
    assert.equal(leave.json.data.approvedCount, 1);
    assert.equal(leave.json.data.approvedDays, 3);
    assert.equal(leave.json.data.pending, 1);
    assert.equal(leave.json.data.byType[0].type, 'Annual');
    assert.equal(leave.json.data.byType[0].days, 3);

    await env.prisma.attendance.createMany({
      data: [
        { employeeId: emp.id, date: new Date('2026-08-03'), status: 'Present', overtimeHrs: 1.5 },
        { employeeId: emp.id, date: new Date('2026-08-04'), status: 'Present' },
        { employeeId: emp.id, date: new Date('2026-08-05'), status: 'Absent' },
        { employeeId: emp.id, date: new Date('2026-08-06'), status: 'HalfDay' },
      ],
    });

    const attendance = await env.request('GET', '/api/reports/attendance-summary?month=8&year=2026', { token });
    assert.equal(attendance.status, 200);
    assert.equal(attendance.json.data.rows.length, 1);
    assert.equal(attendance.json.data.rows[0].present, 2);
    assert.equal(attendance.json.data.rows[0].absent, 1);
    assert.equal(attendance.json.data.rows[0].halfDay, 1);
    assert.equal(attendance.json.data.rows[0].overtimeHrs, 1.5);

    const headcount = await env.request('GET', '/api/reports/headcount', { token });
    assert.equal(headcount.status, 200);
    assert.equal(headcount.json.data.departments.length, 1);
    assert.equal(headcount.json.data.departments[0].total, 1);
    assert.equal(headcount.json.data.departments[0].active, 1);

    const csv = await env.request('GET', '/api/reports/leave-summary?month=8&year=2026&format=csv', { token });
    assert.equal(csv.status, 200);
    assert.match(csv.text, /Leave Type/);
    assert.match(csv.text, /Annual/);
  });

  test('CSV downloads carry attachment headers', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const csv = await env.request('GET', '/api/reports/headcount?format=csv', { token: admin.accessToken });
    assert.equal(csv.status, 200);
    assert.match(String(csv.headers.get('content-type')), /text\/csv/);
    assert.match(String(csv.headers.get('content-disposition')), /headcount\.csv/);
  });

  test('employees cannot read reports', async () => {
    const emp = (await env.prisma.employee.findFirst())!;
    const pwd = await hashPassword('rep123');
    await env.prisma.user.create({ data: { email: 'rep.login@hrpro.com', password: pwd, role: 'Employee', employeeId: emp.id } });
    const login = await loginAs(env, 'rep.login@hrpro.com', 'rep123');
    const res = await env.request('GET', '/api/reports/headcount', { token: login.accessToken });
    assert.equal(res.status, 403);
  });
});