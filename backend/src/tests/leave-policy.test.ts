import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, TestEnv } from './helpers';
import { setupAdminAndEmployee } from './leave-setup';

let env: TestEnv;
let ctx: Awaited<ReturnType<typeof setupAdminAndEmployee>>;

before(async () => {
  env = await startTestEnv('test-policy.db');
  ctx = await setupAdminAndEmployee(env);

  await env.request('PUT', '/api/settings', {
    token: ctx.admin.accessToken,
    body: {
      companyName: 'HR Pro',
      currency: 'USD',
      currencySymbol: '$',
      fiscalYearStartMonth: 1,
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      vacationMaxDaysPerRequest: 3,
      unpaidMaxDaysPerRequest: 2,
    },
  });
});

after(async () => {
  await env.close();
});

describe('per-type caps and cross-year balance enforcement', () => {
  test('vacation requests over the per-request cap are rejected', async () => {
    const over = await env.request('POST', '/api/leaves', {
      token: ctx.admin.accessToken,
      body: { employeeId: ctx.empId, type: 'Vacation', startDate: '2026-08-03', endDate: '2026-08-07', reason: 'too long' },
    });
    assert.equal(over.status, 400);
    assert.match(over.json.error, /maximum of 3 days per request/);

    const ok = await env.request('POST', '/api/leaves', {
      token: ctx.admin.accessToken,
      body: { employeeId: ctx.empId, type: 'Vacation', startDate: '2026-08-03', endDate: '2026-08-05', reason: 'three days' },
    });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.data.totalDays, 3);
  });

  test('editing a request beyond the cap is rejected', async () => {
    const create = await env.request('POST', '/api/leaves', {
      token: ctx.plain.accessToken,
      body: { type: 'Vacation', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'one day' },
    });
    assert.equal(create.status, 201);
    const res = await env.request('PUT', `/api/leaves/${create.json.data.id}`, {
      token: ctx.plain.accessToken,
      body: { endDate: '2026-08-14' },
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /maximum of 3 days per request/);
  });

  test('untracked types fall back to the unpaid cap', async () => {
    const res = await env.request('POST', '/api/leaves', {
      token: ctx.admin.accessToken,
      body: { employeeId: ctx.empId, type: 'Unpaid', startDate: '2026-09-07', endDate: '2026-09-11', reason: 'long unpaid' },
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /maximum of 2 days per request/);
  });

  test('cross-year request is checked against each year balance', async () => {
    for (let i = 0; i < 20; i++) {
      const day = `2025-01-${String(6 + i).padStart(2, '0')}`;
      await env.prisma.leaveRequest.create({
        data: {
          employeeId: ctx.empId,
          type: 'Vacation',
          startDate: new Date(`${day}T00:00:00`),
          endDate: new Date(`${day}T00:00:00`),
          totalDays: 1,
          reason: 'legacy approved',
          status: 'Approved',
        },
      });
    }

    const b2025 = await env.request('GET', `/api/leaves/balances?employeeId=${ctx.empId}&year=2025`, { token: ctx.admin.accessToken });
    const used2025 = b2025.json.data.balances.find((b: any) => b.type === 'Vacation').used;
    assert.equal(used2025, 20);

    const over2025 = await env.request('POST', '/api/leaves', {
      token: ctx.admin.accessToken,
      body: { employeeId: ctx.empId, type: 'Vacation', startDate: '2025-12-29', endDate: '2025-12-31', reason: 'end of year' },
    });
    assert.equal(over2025.status, 400);
    assert.match(over2025.json.error, /balance for 2025/);

    const ok2026 = await env.request('POST', '/api/leaves', {
      token: ctx.admin.accessToken,
      body: { employeeId: ctx.empId, type: 'Vacation', startDate: '2026-01-05', endDate: '2026-01-07', reason: 'start of year' },
    });
    assert.equal(ok2026.status, 201);
  });
});
