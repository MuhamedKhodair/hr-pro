import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;

before(async () => {
  env = await startTestEnv('test-letters.db');
  const dept = await env.prisma.department.create({ data: { name: 'Legal' } });
  await env.prisma.employee.create({
    data: {
      name: 'Letter Writer',
      email: 'letter@hrpro.com',
      position: 'Officer',
      departmentId: dept.id,
      hireDate: new Date('2025-01-01'),
      status: 'Active',
      salary: 2000,
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

describe('letters', () => {
  test('renders employment, salary and leave letters as HTML', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const token = admin.accessToken;
    const emp = (await env.prisma.employee.findFirst())!;

    for (const type of ['employment', 'salary', 'leave'] as const) {
      const res = await env.request('GET', `/api/letters/${type}/${emp.id}`, { token });
      assert.equal(res.status, 200);
      assert.match(String(res.headers.get('content-type') ?? ''), /text\/html/);
      assert.match(res.text, /Letter Writer/);
      assert.match(res.text, /Officer/);
      assert.match(res.text, /Legal/);
      assert.match(res.text, /HR Pro/);
      assert.match(res.text, /window\.print/);
    }

    const salary = await env.request('GET', `/api/letters/salary/${emp.id}`, { token });
    assert.match(salary.text, /\$2,000/);
  });

  test('rejects invalid letter type and missing employee', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const token = admin.accessToken;

    const bad = await env.request('GET', '/api/letters/bogus/noop', { token });
    assert.equal(bad.status, 400);

    const missing = await env.request('GET', '/api/letters/employment/noop', { token });
    assert.equal(missing.status, 404);
  });

  test('requires Admin or HR role', async () => {
    const emp = (await env.prisma.employee.findFirst())!;
    const noAuth = await env.request('GET', `/api/letters/employment/${emp.id}`);
    assert.equal(noAuth.status, 401);

    const pwd = await hashPassword('emp123');
    await env.prisma.user.create({
      data: { email: 'emp@hrpro.com', password: pwd, role: 'Employee', employeeId: emp.id },
    });
    const empLogin = await loginAs(env, 'emp@hrpro.com', 'emp123');
    const forbidden = await env.request('GET', `/api/letters/employment/${emp.id}`, { token: empLogin.accessToken });
    assert.equal(forbidden.status, 403);
  });
});