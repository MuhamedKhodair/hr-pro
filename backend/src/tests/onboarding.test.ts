import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;
let admin: { user: any; accessToken: string; refreshToken: string };
let empToken: { user: any; accessToken: string; refreshToken: string };
let employeeId: string;
let secondEmpId: string;
let taskIds: string[];

before(async () => {
  env = await startTestEnv('test-onboarding.db');
  const dept = await env.prisma.department.create({ data: { name: 'Eng' } });

  const adminPwd = await hashPassword('admin123');
  await env.prisma.user.create({ data: { email: 'ob.admin@hrpro.com', password: adminPwd, role: 'Admin' } });

  const emp = await env.prisma.employee.create({
    data: { name: 'Newbie', email: 'newbie@hrpro.com', position: 'Dev', departmentId: dept.id, hireDate: new Date('2026-08-01'), status: 'Active', salary: 3000 },
  });
  employeeId = emp.id;
  const empPwd = await hashPassword('newbie123');
  await env.prisma.user.create({ data: { email: 'newbie.login@hrpro.com', password: empPwd, role: 'Employee', employeeId: emp.id } });

  const emp2 = await env.prisma.employee.create({
    data: { name: 'Second', email: 'second@hrpro.com', position: 'QA', departmentId: dept.id, hireDate: new Date('2026-08-01'), status: 'Active', salary: 2500 },
  });
  secondEmpId = emp2.id;

  admin = await loginAs(env, 'ob.admin@hrpro.com', 'admin123');
  empToken = await loginAs(env, 'newbie.login@hrpro.com', 'newbie123');
});

after(async () => {
  await env.close();
});

describe('template tasks', () => {
  test('create onboarding tasks', async () => {
    const res = await env.request('POST', '/api/onboarding/tasks', {
      token: admin.accessToken,
      body: { name: 'IT account setup', category: 'IT', isRequired: true, orderIndex: 0 },
    });
    assert.equal(res.status, 201);
    const res2 = await env.request('POST', '/api/onboarding/tasks', {
      token: admin.accessToken,
      body: { name: 'HR orientation', category: 'HR', orderIndex: 1 },
    });
    assert.equal(res2.status, 201);
    taskIds = [res.json.data.id, res2.json.data.id];
  });

  test('employees cannot manage templates', async () => {
    const res = await env.request('POST', '/api/onboarding/tasks', { token: empToken.accessToken, body: { name: 'Nope' } });
    assert.equal(res.status, 403);
  });
});

describe('assignments', () => {
  test('employee create auto-generates assignments', async () => {
    const res = await env.request('POST', '/api/employees', {
      token: admin.accessToken,
      body: { name: 'Auto', email: 'auto@hrpro.com', position: 'Dev', departmentId: undefined, hireDate: '2026-08-10', salary: 2000 },
    });
    assert.equal(res.status, 201);
    const count = await env.prisma.onboardingAssignment.count({ where: { employeeId: res.json.data.id } });
    assert.equal(count, taskIds.length);
  });

  test('manual generate for existing employee', async () => {
    const res = await env.request('POST', `/api/onboarding/assignments/generate/${secondEmpId}`, { token: admin.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.created, taskIds.length);
  });

  test('generate-all backfills without duplicates', async () => {
    const res = await env.request('POST', '/api/onboarding/assignments/generate-all', { token: admin.accessToken });
    assert.equal(res.status, 200);
    const count = await env.prisma.onboardingAssignment.count({ where: { employeeId: secondEmpId } });
    assert.equal(count, taskIds.length);
  });

  test('employee sees only own assignments', async () => {
    const res = await env.request('GET', '/api/onboarding/assignments', { token: empToken.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.length, taskIds.length);
    assert.ok(res.json.data.every((a: any) => a.employeeId === employeeId));
  });

  test('employee cannot list another employee assignments', async () => {
    const res = await env.request('GET', `/api/onboarding/assignments?employeeId=${secondEmpId}`, { token: empToken.accessToken });
    assert.equal(res.status, 403);
  });

  test('employee cannot update someone else assignment', async () => {
    const other = await env.prisma.onboardingAssignment.findFirst({ where: { employeeId: secondEmpId } });
    const res = await env.request('PATCH', `/api/onboarding/assignments/${other!.id}/status`, {
      token: empToken.accessToken,
      body: { status: 'COMPLETED' },
    });
    assert.equal(res.status, 403);
  });

  test('employee completes own assignment and HR is notified at 100%', async () => {
    const mine = await env.prisma.onboardingAssignment.findMany({ where: { employeeId } });
    for (const a of mine) {
      const res = await env.request('PATCH', `/api/onboarding/assignments/${a.id}/status`, {
        token: empToken.accessToken,
        body: { status: 'COMPLETED' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.data.status, 'COMPLETED');
    }
    const notif = await env.prisma.notification.findFirst({ where: { userId: admin.user.id, type: 'onboarding' } });
    assert.ok(notif, 'HR/Admin should be notified when a checklist finishes');
    assert.ok(notif!.message.includes('Newbie'));
  });
});

describe('progress', () => {
  test('progress overview reports percentages', async () => {
    const res = await env.request('GET', '/api/onboarding/progress', { token: admin.accessToken });
    assert.equal(res.status, 200);
    const newbie = res.json.data.find((e: any) => e.id === employeeId);
    assert.equal(newbie.progress, 100);
    const second = res.json.data.find((e: any) => e.id === secondEmpId);
    assert.equal(second.progress, 0);
  });

  test('deactivating a task stops future generations', async () => {
    const res = await env.request('DELETE', `/api/onboarding/tasks/${taskIds[0]}`, { token: admin.accessToken });
    assert.equal(res.status, 200);
    const created = await env.request('POST', '/api/employees', {
      token: admin.accessToken,
      body: { name: 'Late', email: 'late@hrpro.com', position: 'Dev', hireDate: '2026-08-12', salary: 2200 },
    });
    assert.equal(created.status, 201);
    const count = await env.prisma.onboardingAssignment.count({ where: { employeeId: created.json.data.id } });
    assert.equal(count, taskIds.length - 1);
  });
});