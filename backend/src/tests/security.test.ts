import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;

before(async () => {
  env = await startTestEnv('test-security.db');
  const dept = await env.prisma.department.create({ data: { name: 'Engineering' } });
  const pwd = await hashPassword('admin123');
  await env.prisma.user.create({
    data: { email: 'alice@hrpro.com', password: pwd, role: 'Admin' },
  });
  await env.prisma.employee.create({
    data: {
      name: 'Alice Admin',
      email: 'alice.emp@hrpro.com',
      position: 'Manager',
      departmentId: dept.id,
      hireDate: new Date('2024-01-01'),
      status: 'Active',
      salary: 1000,
    },
  });
});

after(async () => {
  await env.close();
});

describe('login lockout', () => {
  test('locks the account after 5 failed attempts, even with the correct password', async () => {
    const pwd = await hashPassword('locked123');
    await env.prisma.user.create({
      data: { email: 'locked@hrpro.com', password: pwd, role: 'Employee' },
    });

    for (let i = 0; i < 4; i++) {
      const res = await env.request('POST', '/api/auth/login', {
        body: { email: 'locked@hrpro.com', password: 'wrong-password' },
      });
      assert.equal(res.status, 401);
    }

    const fifth = await env.request('POST', '/api/auth/login', {
      body: { email: 'locked@hrpro.com', password: 'wrong-password' },
    });
    assert.equal(fifth.status, 429);
    assert.equal(fifth.json.code, 'ACCOUNT_LOCKED');

    const locked = await env.request('POST', '/api/auth/login', {
      body: { email: 'locked@hrpro.com', password: 'locked123' },
    });
    assert.equal(locked.status, 429);
    assert.equal(locked.json.code, 'ACCOUNT_LOCKED');
  });
});

describe('server-enforced forced password change', () => {
  test('blocks all endpoints with FORCED_PASSWORD_CHANGE until password is changed', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const created = await env.request('POST', '/api/auth/register', {
      token: admin.accessToken,
      body: { email: 'newbie@hrpro.com', password: 'Temp1234', role: 'Employee' },
    });
    assert.equal(created.status, 201);

    const login = await loginAs(env, 'newbie@hrpro.com', 'Temp1234');
    assert.equal(login.user.mustChangePassword, true);

    const blocked = await env.request('GET', '/api/leaves', { token: login.accessToken });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.code, 'FORCED_PASSWORD_CHANGE');

    const changed = await env.request('PUT', '/api/auth/me/password', {
      token: login.accessToken,
      body: { currentPassword: 'Temp1234', newPassword: 'FreshPass1' },
    });
    assert.equal(changed.status, 200);

    const allowed = await env.request('GET', '/api/leaves', { token: login.accessToken });
    assert.equal(allowed.status, 200);
  });
});

describe('user deletion revokes sessions', () => {
  test('refresh token is dead after the account is deleted', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const created = await env.request('POST', '/api/auth/register', {
      token: admin.accessToken,
      body: { email: 'doomed@hrpro.com', password: 'Temp1234' },
    });
    assert.equal(created.status, 201);
    const userId = created.json.data.user.id;

    const login = await loginAs(env, 'doomed@hrpro.com', 'Temp1234');

    const del = await env.request('DELETE', `/api/users/${userId}`, { token: admin.accessToken });
    assert.equal(del.status, 200);

    const refresh = await env.request('POST', '/api/auth/refresh', {
      body: { refreshToken: login.refreshToken },
    });
    assert.equal(refresh.status, 401);
  });
});

describe('spreadsheet export formula-injection neutralization', () => {
  test('CSV export prefixes formula cells with a quote', async () => {
    await env.prisma.employee.create({
      data: {
        name: '=HYPERLINK("http://evil.example","click")',
        email: 'evil@hrpro.com',
        position: 'Dev',
        departmentId: (await env.prisma.department.findFirst())!.id,
        hireDate: new Date('2025-01-01'),
        status: 'Active',
        salary: 500,
      },
    });

    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const raw = await fetch(env.base + '/api/employees/export/csv', {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(raw.status, 200);
    const body = await raw.text();
    assert.ok(body.includes("'=HYPERLINK"), 'formula cell must be neutralized with a leading quote');
  });
});

describe('upload magic-byte verification', () => {
  async function uploadFile(path: string, filename: string, contentType: string, content: Buffer | string, token: string) {
    const form = new FormData();
    form.append('file', new Blob([content as any], { type: contentType }), filename);
    const res = await fetch(env.base + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    let json: any;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  }

  test('rejects a text file disguised as a PNG', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const res = await uploadFile('/api/uploads/leave', 'fake.png', 'image/png', 'this is not an image', admin.accessToken);
    assert.equal(res.status, 400);
    assert.match(res.json.error, /content does not match/i);
  });

  test('accepts a file with real PNG magic bytes', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await uploadFile('/api/uploads/leave', 'ok.png', 'image/png', pngHeader, admin.accessToken);
    assert.equal(res.status, 201);
  });

  test('rejects an Excel import that is not a real workbook', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const res = await uploadFile(
      '/api/uploads/employees/import',
      'employees.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'plain text pretending to be excel',
      admin.accessToken,
    );
    assert.equal(res.status, 400);
    assert.match(res.json.error, /not appear to be an Excel workbook/i);
  });
});

describe('password policy', () => {
  test('rejects weak passwords on registration', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const weak = await env.request('POST', '/api/auth/register', {
      token: admin.accessToken,
      body: { email: 'weak@hrpro.com', password: 'password1', role: 'Employee' },
    });
    assert.equal(weak.status, 400);
    assert.match(weak.json.error, /uppercase/i);

    const strong = await env.request('POST', '/api/auth/register', {
      token: admin.accessToken,
      body: { email: 'strong@hrpro.com', password: 'Str0ngPass', role: 'Employee' },
    });
    assert.equal(strong.status, 201);
  });

  test('rejects reuse of a recent password', async () => {
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    await env.request('POST', '/api/auth/register', {
      token: admin.accessToken,
      body: { email: 'history@hrpro.com', password: 'FirstPass1', role: 'Employee' },
    });
    const login = await loginAs(env, 'history@hrpro.com', 'FirstPass1');

    const first = await env.request('PUT', '/api/auth/me/password', {
      token: login.accessToken,
      body: { currentPassword: 'FirstPass1', newPassword: 'SecondPass2' },
    });
    assert.equal(first.status, 200);

    const reuse = await env.request('PUT', '/api/auth/me/password', {
      token: login.accessToken,
      body: { currentPassword: 'SecondPass2', newPassword: 'FirstPass1' },
    });
    assert.equal(reuse.status, 400);
    assert.match(reuse.json.error, /used recently/i);

    const reuseCurrent = await env.request('PUT', '/api/auth/me/password', {
      token: login.accessToken,
      body: { currentPassword: 'SecondPass2', newPassword: 'SecondPass2' },
    });
    assert.equal(reuseCurrent.status, 400);
  });
});

describe('httpOnly cookie sessions', () => {
  function jarFromSetCookie(res: Response): { jar: string; setCookies: string[] } {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    return { jar: setCookies.map((c) => c.split(';')[0]).join('; '), setCookies };
  }

  async function cookieLogin(email: string, password: string) {
    const res = await fetch(env.base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return jarFromSetCookie(res);
  }

  test('login sets HttpOnly auth cookies and they authenticate requests', async () => {
    const { jar, setCookies } = await cookieLogin('alice@hrpro.com', 'admin123');
    assert.ok(jar.includes('hrpro_access='), 'access cookie must be set');
    assert.ok(jar.includes('hrpro_refresh='), 'refresh cookie must be set');
    assert.ok(setCookies.every((c) => c.toLowerCase().includes('httponly')), 'cookies must be HttpOnly');

    const res = await fetch(env.base + '/api/leaves', {
      headers: { Cookie: jar },
    });
    assert.equal(res.status, 200);
  });

  test('refresh rotates via the cookie without a bearer token', async () => {
    const { jar } = await cookieLogin('alice@hrpro.com', 'admin123');
    const res = await fetch(env.base + '/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: jar },
    });
    assert.equal(res.status, 200);
    const rotated = jarFromSetCookie(res);
    assert.ok(rotated.jar.includes('hrpro_refresh='), 'rotated refresh cookie must be issued');
    assert.notEqual(rotated.jar, jar, 'cookies must rotate');
  });

  test('logout clears the cookies', async () => {
    const { jar } = await cookieLogin('alice@hrpro.com', 'admin123');
    const res = await fetch(env.base + '/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: jar },
    });
    assert.equal(res.status, 200);
    const cleared = jarFromSetCookie(res).setCookies.join('; ').toLowerCase();
    assert.ok(cleared.includes('hrpro_access=') && cleared.includes('expires='), 'access cookie must be expired');
    assert.ok(cleared.includes('hrpro_refresh=') && cleared.includes('expires='), 'refresh cookie must be expired');

    const browserJar = jar
      .split('; ')
      .filter((c) => !c.startsWith('hrpro_access=') && !c.startsWith('hrpro_refresh='))
      .join('; ');
    const stale = await fetch(env.base + '/api/leaves', { headers: { Cookie: browserJar } });
    assert.equal(stale.status, 401);
  });
});

describe('unknown routes', () => {
  test('returns 404 JSON for unknown API paths', async () => {
    const res = await env.request('GET', '/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.json.success, false);
  });
});
