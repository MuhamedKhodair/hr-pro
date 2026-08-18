import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, TestEnv } from './helpers';
import { setupAdminAndEmployee } from './leave-setup';

let env: TestEnv;
let ctx: Awaited<ReturnType<typeof setupAdminAndEmployee>>;

before(async () => {
  env = await startTestEnv('test-holiday.db');
  ctx = await setupAdminAndEmployee(env);
});

after(async () => {
  await env.close();
});

describe('holiday-aware leave calculation and multi-year split', () => {
  test('holiday CRUD is Admin-only', async () => {
    const denied = await env.request('POST', '/api/holidays', {
      token: ctx.plain.accessToken,
      body: { name: 'Hack Day', date: '2026-12-31' },
    });
    assert.equal(denied.status, 403);

    const created = await env.request('POST', '/api/holidays', {
      token: ctx.admin.accessToken,
      body: { name: 'National Day', date: '2026-08-19' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.name, 'National Day');

    const dup = await env.request('POST', '/api/holidays', {
      token: ctx.admin.accessToken,
      body: { name: 'Duplicate', date: '2026-08-19' },
    });
    assert.equal(dup.status, 400);

    const list = await env.request('GET', '/api/holidays', { token: ctx.plain.accessToken });
    assert.equal(list.status, 200);
    assert.equal(list.json.data.length, 1);

    const del = await env.request('DELETE', `/api/holidays/${created.json.data.id}`, { token: ctx.admin.accessToken });
    assert.equal(del.status, 200);
  });

  test('holiday inside a working week is excluded from the total', async () => {
    await env.request('POST', '/api/holidays', {
      token: ctx.admin.accessToken,
      body: { name: 'National Day', date: '2026-08-19' },
    });
    const res = await env.request('POST', '/api/leaves', {
      token: ctx.admin.accessToken,
      body: { employeeId: ctx.empId, type: 'Vacation', startDate: '2026-08-17', endDate: '2026-08-21', reason: 'week with holiday' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.totalDays, 4);
  });

  test('cross-year leave splits and consumes each year balance separately', async () => {
    await env.request('POST', '/api/holidays', {
      token: ctx.admin.accessToken,
      body: { name: 'New Year', date: '2026-01-01' },
    });
    const res = await env.request('POST', '/api/leaves', {
      token: ctx.admin.accessToken,
      body: { employeeId: ctx.empId, type: 'Vacation', startDate: '2025-12-29', endDate: '2026-01-02', reason: 'new year break' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.totalDays, 4);
    assert.deepEqual(JSON.parse(res.json.data.yearSplit), [
      { year: 2025, days: 3 },
      { year: 2026, days: 1 },
    ]);

    await env.request('PUT', `/api/leaves/${res.json.data.id}/review`, {
      token: ctx.admin.accessToken,
      body: { status: 'Approved', comment: 'ok' },
    });

    const b2025 = await env.request('GET', `/api/leaves/balances?employeeId=${ctx.empId}&year=2025`, { token: ctx.admin.accessToken });
    assert.equal(b2025.status, 200);
    const vac2025 = b2025.json.data.balances.find((b: any) => b.type === 'Vacation');
    assert.equal(vac2025.used, 3);

    const b2026 = await env.request('GET', `/api/leaves/balances?employeeId=${ctx.empId}&year=2026`, { token: ctx.admin.accessToken });
    assert.equal(b2026.status, 200);
    const vac2026 = b2026.json.data.balances.find((b: any) => b.type === 'Vacation');
    assert.equal(vac2026.used, 1);
  });
});
