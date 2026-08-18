import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;
let admin: { user: any; accessToken: string };
let hr: { user: any; accessToken: string };
let plain: { user: any; accessToken: string };
let ids: Record<string, string>;

before(async () => {
  env = await startTestEnv('test-access.db');
  const dept = await env.prisma.department.create({ data: { name: 'Ops' } });

  const managerEmp = await env.prisma.employee.create({
    data: { name: 'Manager', email: 'manager@hrpro.com', position: 'Lead', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 5000 },
  });
  const reportEmp = await env.prisma.employee.create({
    data: { name: 'Report', email: 'report@hrpro.com', position: 'Dev', departmentId: dept.id, hireDate: new Date('2025-06-01'), status: 'Active', salary: 3000, reportsToId: managerEmp.id },
  });
  const plainEmp = await env.prisma.employee.create({
    data: { name: 'Plain', email: 'plain@hrpro.com', position: 'QA', departmentId: dept.id, hireDate: new Date('2025-02-01'), status: 'Active', salary: 2000 },
  });
  ids = { manager: managerEmp.id, report: reportEmp.id, plain: plainEmp.id };

  await env.prisma.department.create({ data: { name: 'Other Dept' } });

  const adminPwd = await hashPassword('admin123');
  await env.prisma.user.create({ data: { email: 'alice@hrpro.com', password: adminPwd, role: 'Admin' } });
  const hrPwd = await hashPassword('hrpass1');
  const hrUser = await env.prisma.user.create({ data: { email: 'hr.login@hrpro.com', password: hrPwd, role: 'HR' } });

  const managerUser = await env.prisma.user.create({
    data: { email: 'manager.login@hrpro.com', password: await hashPassword('mgrpass1'), role: 'Employee', employeeId: managerEmp.id },
  });
  const plainUser = await env.prisma.user.create({
    data: { email: 'plain.login@hrpro.com', password: await hashPassword('plain123'), role: 'Employee', employeeId: plainEmp.id },
  });

  admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
  hr = await loginAs(env, 'hr.login@hrpro.com', 'hrpass1');
  const mgr = await loginAs(env, 'manager.login@hrpro.com', 'mgrpass1');
  plain = await loginAs(env, 'plain.login@hrpro.com', 'plain123');
  ids.mgrToken = mgr.accessToken;
});

after(async () => {
  await env.close();
});

describe('employee read scope', () => {
  test('employee list returns only the logged-in employee', async () => {
    const res = await env.request('GET', '/api/employees', { token: plain.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.length, 1);
    assert.equal(res.json.data[0].id, ids.plain);
  });

  test('admin and HR see all employees', async () => {
    const res = await env.request('GET', '/api/employees', { token: admin.accessToken });
    assert.equal(res.status, 200);
    assert.ok(res.json.data.length >= 3);
    const hrRes = await env.request('GET', '/api/employees', { token: hr.accessToken });
    assert.equal(hrRes.status, 200);
    assert.ok(hrRes.json.data.length >= 3);
  });

  test('employee detail: own 200, other 403', async () => {
    const own = await env.request('GET', `/api/employees/${ids.plain}`, { token: plain.accessToken });
    assert.equal(own.status, 200);
    const other = await env.request('GET', `/api/employees/${ids.manager}`, { token: plain.accessToken });
    assert.equal(other.status, 403);
  });

  test('exports and org chart are Admin/HR only', async () => {
    const csv = await env.request('GET', '/api/employees/export/csv', { token: plain.accessToken });
    assert.equal(csv.status, 403);
    const xlsx = await env.request('GET', '/api/employees/export/xlsx', { token: plain.accessToken });
    assert.equal(xlsx.status, 403);
    const chart = await env.request('GET', '/api/employees/org-chart', { token: plain.accessToken });
    assert.equal(chart.status, 403);
    assert.equal((await env.request('GET', '/api/employees/org-chart', { token: admin.accessToken })).status, 200);
  });
});

describe('attendance read scope', () => {
  test('employee range query cannot peer into others', async () => {
    const res = await env.request(
      'GET',
      `/api/attendance/range?start=2026-08-01&end=2026-08-31&employeeId=${ids.report}`,
      { token: plain.accessToken },
    );
    assert.equal(res.status, 200);
    assert.ok(res.json.data.every((r: any) => r.employeeId === ids.plain));
  });

  test('employee monthly view is own-only', async () => {
    const other = await env.request('GET', `/api/attendance/monthly/${ids.report}/2026/8`, { token: plain.accessToken });
    assert.equal(other.status, 403);
    const own = await env.request('GET', `/api/attendance/monthly/${ids.plain}/2026/8`, { token: plain.accessToken });
    assert.equal(own.status, 200);
  });
});

describe('dashboard scope', () => {
  test('employee stats are scoped to own team', async () => {
    const res = await env.request('GET', '/api/dashboard/stats', { token: plain.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.totalEmployees, 1);
    const mgrRes = await env.request('GET', '/api/dashboard/stats', { token: ids.mgrToken });
    assert.equal(mgrRes.json.data.totalEmployees, 2);
    const adminRes = await env.request('GET', '/api/dashboard/stats', { token: admin.accessToken });
    assert.ok(adminRes.json.data.totalEmployees >= 3);
  });

  test('employee headcount hides departments outside scope', async () => {
    const res = await env.request('GET', '/api/dashboard/headcount', { token: plain.accessToken });
    const names = res.json.data.byDepartment.map((d: any) => d.name);
    assert.ok(!names.includes('Other Dept'));
    const adminRes = await env.request('GET', '/api/dashboard/headcount', { token: admin.accessToken });
    assert.ok(adminRes.json.data.byDepartment.some((d: any) => d.name === 'Other Dept'));
  });

  test('employee activity only mentions own scope', async () => {
    await env.request('POST', '/api/leaves', {
      token: admin.accessToken,
      body: { employeeId: ids.report, type: 'Personal', startDate: '2026-09-01', endDate: '2026-09-02', reason: 'activity check' },
    });
    const res = await env.request('GET', '/api/dashboard/activity', { token: plain.accessToken });
    assert.equal(res.status, 200);
    for (const a of res.json.data) {
      assert.ok(!a.message.includes('Report submitted'));
    }
  });
});

describe('search scope', () => {
  test('employee search cannot find colleagues by name', async () => {
    const res = await env.request('GET', '/api/search?q=Report', { token: plain.accessToken });
    assert.equal(res.json.data.employees.length, 0);
    const own = await env.request('GET', '/api/search?q=Plain', { token: plain.accessToken });
    assert.equal(own.json.data.employees.length, 1);
    const adminRes = await env.request('GET', '/api/search?q=Report', { token: admin.accessToken });
    assert.ok(adminRes.json.data.employees.length >= 1);
  });

  test('employee search departments are limited to own department', async () => {
    const res = await env.request('GET', '/api/search?q=Dept', { token: plain.accessToken });
    for (const d of res.json.data.departments) {
      assert.equal(d.name, 'Ops');
    }
  });
});