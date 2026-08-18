import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;
let admin: { user: any; accessToken: string; refreshToken: string };
let mgr: { user: any; accessToken: string; refreshToken: string };
let subId: string;
let otherId: string;
let plain: { user: any; accessToken: string; refreshToken: string };

before(async () => {
  env = await startTestEnv('test-leaves.db');
  const dept = await env.prisma.department.create({ data: { name: 'Ops' } });

  const adminPwd = await hashPassword('admin123');
  const adminUser = await env.prisma.user.create({ data: { email: 'alice@hrpro.com', password: adminPwd, role: 'Admin' } });

  const mgrEmp = await env.prisma.employee.create({
    data: { name: 'Mgr', email: 'mgr@hrpro.com', position: 'Lead', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 5000 },
  });
  const mgrPwd = await hashPassword('mgrpass1');
  const mgrUser = await env.prisma.user.create({ data: { email: 'mgr.login@hrpro.com', password: mgrPwd, role: 'Employee', employeeId: mgrEmp.id } });

  const subEmp = await env.prisma.employee.create({
    data: { name: 'Sub', email: 'sub@hrpro.com', position: 'Dev', departmentId: dept.id, hireDate: new Date('2025-06-01'), status: 'Active', salary: 3000, reportsToId: mgrEmp.id },
  });
  const otherEmp = await env.prisma.employee.create({
    data: { name: 'Other', email: 'other@hrpro.com', position: 'Analyst', departmentId: dept.id, hireDate: new Date('2025-03-01'), status: 'Active', salary: 4000 },
  });

  const plainEmp = await env.prisma.employee.create({
    data: { name: 'Plain', email: 'plain@hrpro.com', position: 'QA', departmentId: dept.id, hireDate: new Date('2025-02-01'), status: 'Active', salary: 2000 },
  });
  const plainPwd = await hashPassword('plain123');
  const plainUser = await env.prisma.user.create({ data: { email: 'plain.login@hrpro.com', password: plainPwd, role: 'Employee', employeeId: plainEmp.id } });

  subId = subEmp.id;
  otherId = otherEmp.id;

  admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
  mgr = await loginAs(env, 'mgr.login@hrpro.com', 'mgrpass1');
  plain = await loginAs(env, 'plain.login@hrpro.com', 'plain123');
});

after(async () => {
  await env.close();
});

describe('weekend-aware leave calculation', () => {
  test('Friday to Monday counts only working days (2)', async () => {
    const res = await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: subId, type: 'Personal', startDate: '2026-08-14', endDate: '2026-08-17', reason: 'weekend test' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.totalDays, 2);
  });

  test('single Friday half-day is 0.5', async () => {
    const res = await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: subId, type: 'Personal', startDate: '2026-08-14', endDate: '2026-08-14', reason: 'half day', halfDayStart: true },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.totalDays, 0.5);
  });
});

describe('manager scope', () => {
  test('manager sees only own leaves, not direct reports or others', async () => {
    const own = await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: mgr.user.employeeId, type: 'Personal', startDate: '2026-08-20', endDate: '2026-08-21', reason: 'mgr own' },
    });
    const sub = await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: subId, type: 'Personal', startDate: '2026-08-22', endDate: '2026-08-23', reason: 'sub' },
    });
    const other = await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: otherId, type: 'Personal', startDate: '2026-08-25', endDate: '2026-08-26', reason: 'other' },
    });

    const list = await env.request('GET', '/api/leaves/my', { token: mgr.accessToken });
    assert.equal(list.status, 200);
    const ids = list.json.data.map((l: any) => l.id);
    assert.ok(ids.includes(own.json.data.id));
    assert.ok(!ids.includes(sub.json.data.id));
    assert.ok(!ids.includes(other.json.data.id));
  });

  test('manager cannot view or review outside their scope', async () => {
    const other = await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: otherId, type: 'Personal', startDate: '2026-09-01', endDate: '2026-09-02', reason: 'other 2' },
    });

    const get = await env.request('GET', `/api/leaves/${other.json.data.id}`, { token: mgr.accessToken });
    assert.equal(get.status, 403);

    const review = await env.request('PUT', `/api/leaves/${other.json.data.id}/review`, {
      token: mgr.accessToken,
      body: { status: 'Approved' },
    });
    assert.equal(review.status, 403);
  });

  test('manager cannot review direct report leaves (review is Admin/HR only)', async () => {
    const subLeave = await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: subId, type: 'Personal', startDate: '2026-09-10', endDate: '2026-09-11', reason: 'sub pending' },
    });
    const review = await env.request('PUT', `/api/leaves/${subLeave.json.data.id}/review`, {
      token: mgr.accessToken,
      body: { status: 'Approved', comment: 'ok' },
    });
    assert.equal(review.status, 403);
  });

  test('non-manager employee cannot review anyone', async () => {
    const subLeave = await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: subId, type: 'Personal', startDate: '2026-09-20', endDate: '2026-09-21', reason: 'sub pending 2' },
    });
    const review = await env.request('PUT', `/api/leaves/${subLeave.json.data.id}/review`, {
      token: plain.accessToken,
      body: { status: 'Approved' },
    });
    assert.equal(review.status, 403);
  });
});
