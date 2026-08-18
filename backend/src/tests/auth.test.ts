import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;

before(async () => {
  env = await startTestEnv('test-auth.db');
  const dept = await env.prisma.department.create({ data: { name: 'Engineering' } });
  const pwd = await hashPassword('admin123');
  await env.prisma.user.create({
    data: { email: 'alice@hrpro.com', password: pwd, role: 'Admin' },
  });
});

after(async () => {
  await env.close();
});

describe('registration is admin-only', () => {
  test('anonymous register is rejected', async () => {
    const res = await env.request('POST', '/api/auth/register', {
      body: { email: 'anon@x.com', password: 'secret1', role: 'Admin' },
    });
    assert.equal(res.status, 401);
  });

  test('admin can create a user, who must change password on first login', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const res = await env.request('POST', '/api/auth/register', {
      token: admin.accessToken,
      body: { email: 'bob@hrpro.com', password: 'Temp1234', role: 'HR' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.user.role, 'HR');

    const login = await loginAs(env, 'bob@hrpro.com', 'Temp1234');
    assert.equal(login.user.mustChangePassword, true);
  });

  test('employee cannot create users', async () => {
    const dept = await env.prisma.department.findFirst();
    const emp = await env.prisma.employee.create({
      data: { name: 'Plain', email: 'plain@hrpro.com', position: 'Dev', departmentId: dept!.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
    });
    const pwd = await hashPassword('plain123');
    const user = await env.prisma.user.create({ data: { email: 'plain.login@hrpro.com', password: pwd, role: 'Employee', employeeId: emp.id } });
    const login = await loginAs(env, 'plain.login@hrpro.com', 'plain123');
    const res = await env.request('POST', '/api/auth/register', {
      token: login.accessToken,
      body: { email: 'nope@hrpro.com', password: 'secret1' },
    });
    assert.equal(res.status, 403);
  });
});

describe('refresh token rotation', () => {
  test('old refresh token is invalid after rotation, new one works', async () => {
    const first = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const rotated = await env.request('POST', '/api/auth/refresh', { body: { refreshToken: first.refreshToken } });
    assert.equal(rotated.status, 200);
    const rotatedToken = rotated.json.data.refreshToken;

    const reuse = await env.request('POST', '/api/auth/refresh', { body: { refreshToken: first.refreshToken } });
    assert.equal(reuse.status, 401);
    assert.match(reuse.json.error, /revoked/i);

    // Reuse detection revokes every session of the user, including the rotated one
    const afterReuse = await env.request('POST', '/api/auth/refresh', { body: { refreshToken: rotatedToken } });
    assert.equal(afterReuse.status, 401);
  });

  test('logout revokes the refresh token', async () => {
    const login = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const logout = await env.request('POST', '/api/auth/logout', {
      token: login.accessToken,
      body: { refreshToken: login.refreshToken },
    });
    assert.equal(logout.status, 200);
    const refresh = await env.request('POST', '/api/auth/refresh', { body: { refreshToken: login.refreshToken } });
    assert.equal(refresh.status, 401);
  });
});

describe('sessions', () => {
  test('lists active sessions and can revoke one', async () => {
    const first = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const second = await loginAs(env, 'alice@hrpro.com', 'admin123');

    const list = await env.request('GET', '/api/auth/sessions', { token: first.accessToken });
    assert.equal(list.status, 200);
    assert.ok(list.json.data.length >= 2);

    // Revoke every listed session (order is not guaranteed within the same millisecond)
    for (const session of list.json.data) {
      const del = await env.request('DELETE', `/api/auth/sessions/${session.id}`, { token: first.accessToken });
      assert.equal(del.status, 200);
    }

    const revoked1 = await env.request('POST', '/api/auth/refresh', { body: { refreshToken: first.refreshToken } });
    assert.equal(revoked1.status, 401);
    const revoked2 = await env.request('POST', '/api/auth/refresh', { body: { refreshToken: second.refreshToken } });
    assert.equal(revoked2.status, 401);

    // A fresh login still works
    const fresh = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const stillActive = await env.request('POST', '/api/auth/refresh', { body: { refreshToken: fresh.refreshToken } });
    assert.equal(stillActive.status, 200);
  });
});

describe('password change', () => {
  test('rejects wrong current password', async () => {
    const login = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const res = await env.request('PUT', '/api/auth/me/password', {
      token: login.accessToken,
      body: { currentPassword: 'wrong', newPassword: 'Newpass9' },
    });
    assert.equal(res.status, 400);
  });

  test('clears mustChangePassword flag after change', async () => {
    const login = await loginAs(env, 'bob@hrpro.com', 'Temp1234');
    assert.equal(login.user.mustChangePassword, true);

    const res = await env.request('PUT', '/api/auth/me/password', {
      token: login.accessToken,
      body: { currentPassword: 'Temp1234', newPassword: 'BobNewpass9' },
    });
    assert.equal(res.status, 200);

    const relogin = await loginAs(env, 'bob@hrpro.com', 'BobNewpass9');
    assert.equal(relogin.user.mustChangePassword, false);
  });
});

describe('whitelist self-registration', () => {
  test('disabled by default, whitelist required, links to active employee only', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');

    // Disabled by default
    const disabled = await env.request('POST', '/api/auth/register/self', {
      body: { email: 'newbie@hrpro.com', password: 'Newpass9' },
    });
    assert.equal(disabled.status, 403);

    // Enable but keep whitelist empty -> still blocked
    await env.request('PUT', '/api/settings', {
      token: admin.accessToken,
    body: { companyName: 'HR Pro', currency: 'USD', currencySymbol: '$', fiscalYearStartMonth: 1, workingDays: ['Mon','Tue','Wed','Thu','Fri'], allowPublicRegistration: true },
    });

    // No matching active employee -> blocked even though domain is whitelisted
    await env.request('PUT', '/api/settings', {
      token: admin.accessToken,
      body: { companyName: 'HR Pro', currency: 'USD', currencySymbol: '$', fiscalYearStartMonth: 1, workingDays: ['Mon','Tue','Wed','Thu','Fri'], allowPublicRegistration: true, registrationWhitelist: '@hrpro.com' },
    });
    const noEmployee = await env.request('POST', '/api/auth/register/self', {
      body: { email: 'ghost@hrpro.com', password: 'Newpass9' },
    });
    assert.equal(noEmployee.status, 403);
    assert.match(noEmployee.json.error, /employee record/i);

    // Exact-email whitelist entry that does not match -> blocked
    const dept = await env.prisma.department.findFirst();
    await env.prisma.employee.create({
      data: { name: 'Whitelist', email: 'wl@hrpro.com', position: 'Dev', departmentId: dept!.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 1000 },
    });
    await env.request('PUT', '/api/settings', {
      token: admin.accessToken,
      body: { companyName: 'HR Pro', currency: 'USD', currencySymbol: '$', fiscalYearStartMonth: 1, workingDays: ['Mon','Tue','Wed','Thu','Fri'], allowPublicRegistration: true, registrationWhitelist: 'other@hrpro.com' },
    });
    const notAllowed = await env.request('POST', '/api/auth/register/self', {
      body: { email: 'wl@hrpro.com', password: 'Newpass9' },
    });
    assert.equal(notAllowed.status, 403);
    assert.match(notAllowed.json.error, /not allowed/i);

    // Domain whitelist + active employee -> success, linked as Employee
    await env.request('PUT', '/api/settings', {
      token: admin.accessToken,
      body: { companyName: 'HR Pro', currency: 'USD', currencySymbol: '$', fiscalYearStartMonth: 1, workingDays: ['Mon','Tue','Wed','Thu','Fri'], allowPublicRegistration: true, registrationWhitelist: '@hrpro.com' },
    });
    const ok = await env.request('POST', '/api/auth/register/self', {
      body: { email: 'wl@hrpro.com', password: 'Newpass9' },
    });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.data.user.role, 'Employee');
    assert.equal(ok.json.data.user.mustChangePassword, false);
    assert.ok(ok.json.data.user.employeeId);

    // The new account can log in immediately
    const login = await loginAs(env, 'wl@hrpro.com', 'Newpass9');
    assert.equal(login.user.email, 'wl@hrpro.com');

    // Duplicate registration is rejected
    const dup = await env.request('POST', '/api/auth/register/self', {
      body: { email: 'wl@hrpro.com', password: 'Newpass9' },
    });
    assert.equal(dup.status, 409);
  });
});
