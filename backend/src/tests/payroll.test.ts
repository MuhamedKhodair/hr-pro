import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;

async function createEmployee(name: string, email: string, deptId: string) {
  return env.prisma.employee.create({
    data: {
      name,
      email,
      position: 'Dev',
      departmentId: deptId,
      hireDate: new Date('2025-01-01'),
      status: 'Active',
      salary: 1000,
    },
  });
}

async function createStructure(employeeId: string, baseSalary: number, effectiveFrom: string) {
  const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
  const res = await env.request('POST', '/api/salary/salary-structure', {
    token: admin.accessToken,
    body: { employeeId, baseSalary, effectiveFrom },
  });
  assert.equal(res.status, 201);
  return res.json.data;
}

before(async () => {
  env = await startTestEnv('test-payroll.db');
  await env.prisma.department.create({ data: { name: 'Engineering' } });
  const pwd = await hashPassword('admin123');
  await env.prisma.user.create({
    data: { email: 'alice@hrpro.com', password: pwd, role: 'Admin' },
  });
});

after(async () => {
  await env.close();
});

describe('salary structure supersede is transactional', () => {
  test('concurrent supersedes leave exactly one active structure', async () => {
    const employee = await createEmployee('Concurrent', 'concurrent@hrpro.com', (await env.prisma.department.findFirst())!.id);

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createStructure(employee.id, 2000 + i, '2026-01-15'),
      ),
    );
    assert.equal(responses.length, 5);

    const rows = await env.prisma.salaryStructure.findMany({ where: { employeeId: employee.id } });
    assert.equal(rows.length, 5);
    const open = rows.filter((r) => r.effectiveTo === null);
    assert.equal(open.length, 1, 'exactly one structure must remain active');
    const closed = rows.filter((r) => r.effectiveTo !== null);
    assert.equal(closed.length, 4);
    assert.ok(closed.every((r) => r.effectiveTo !== null && r.effectiveTo >= r.effectiveFrom));
  });
});

describe('payroll preview correctness', () => {
  test('overtime hours beyond the standard work day are paid', async () => {
    const employee = await createEmployee('Overtime', 'ot@hrpro.com', (await env.prisma.department.findFirst())!.id);
    await createStructure(employee.id, 3000, '2026-01-01');

    await env.prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date: new Date('2026-06-10T00:00:00Z'),
        status: 'Present',
        checkIn: new Date('2026-06-10T08:00:00'),
        checkOut: new Date('2026-06-10T20:00:00'),
      },
    });

    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const res = await env.request(
      'GET',
      `/api/salary/payroll/preview?employeeId=${employee.id}&month=6&year=2026`,
      { token: admin.accessToken },
    );
    assert.equal(res.status, 200);
    assert.ok(res.json.data.overtimePay > 0, `expected overtimePay > 0, got ${res.json.data.overtimePay}`);
    assert.ok(res.json.data.netSalary > 3000, 'net must exceed base when overtime is paid');
  });

  test('net salary is never negative', async () => {
    const employee = await createEmployee('Clamped', 'clamped@hrpro.com', (await env.prisma.department.findFirst())!.id);
    await createStructure(employee.id, 3000, '2026-01-01');

    await env.prisma.salaryComponent.create({
      data: { employeeId: employee.id, type: 'DEDUCTION', label: 'Fines', amount: 20000, isRecurring: true },
    });
    for (let day = 1; day <= 30; day++) {
      await env.prisma.attendance.create({
        data: {
          employeeId: employee.id,
          date: new Date(2026, 5, day),
          status: 'Absent',
        },
      });
    }

    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const res = await env.request(
      'GET',
      `/api/salary/payroll/preview?employeeId=${employee.id}&month=6&year=2026`,
      { token: admin.accessToken },
    );
    assert.equal(res.status, 200);
    assert.equal(res.json.data.netSalary, 0);
    assert.ok(res.json.data.netSalary >= 0);
  });
});

describe('payroll lifecycle to PAID', () => {
  test('DRAFT -> FINALIZED -> PAID, with guards at each step', async () => {
    const employee = await createEmployee('Lifeline', 'life@hrpro.com', (await env.prisma.department.findFirst())!.id);
    await createStructure(employee.id, 3000, '2026-01-01');

    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');

    const generated = await env.request('POST', '/api/salary/payroll/generate', {
      token: admin.accessToken,
      body: { employeeIds: [employee.id], month: 6, year: 2026 },
    });
    assert.equal(generated.status, 201);
    const id = generated.json.data[0].payrollRecordId;
    assert.ok(id);

    const paidTooEarly = await env.request('POST', `/api/salary/payroll/${id}/mark-paid`, {
      token: admin.accessToken,
    });
    assert.equal(paidTooEarly.status, 400);

    const finalized = await env.request('POST', `/api/salary/payroll/${id}/finalize`, {
      token: admin.accessToken,
    });
    assert.equal(finalized.status, 200);
    assert.equal(finalized.json.data.status, 'FINALIZED');

    const paid = await env.request('POST', `/api/salary/payroll/${id}/mark-paid`, {
      token: admin.accessToken,
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.json.data.status, 'PAID');
    assert.ok(paid.json.data.paidAt);

    const doublePaid = await env.request('POST', `/api/salary/payroll/${id}/mark-paid`, {
      token: admin.accessToken,
    });
    assert.equal(doublePaid.status, 400);
  });
});
describe('employee payslip self-service', () => {
  test('own FINALIZED payslip is visible with components; DRAFT and foreign payslips are hidden', async () => {
    const deptId = (await env.prisma.department.findFirst())!.id;
    const emp = await createEmployee('Self', 'self@hrpro.com', deptId);
    const other = await createEmployee('OtherSelf', 'otherself@hrpro.com', deptId);
    const admin = await loginAs(env, 'alice@hrpro.com', 'admin123');
    const empPwd = await hashPassword('self123');
    await env.prisma.user.create({ data: { email: 'self.login@hrpro.com', password: empPwd, role: 'Employee', employeeId: emp.id } });
    const empToken = await loginAs(env, 'self.login@hrpro.com', 'self123');

    await createStructure(emp.id, 2500, '2026-01-01');
    await createStructure(other.id, 2500, '2026-01-01');

    const gen = await env.request('POST', '/api/salary/payroll/generate', {
      token: admin.accessToken,
      body: { employeeIds: [emp.id, other.id], month: 7, year: 2026 },
    });
    assert.equal(gen.status, 201);
    const myRecord = gen.json.data.find((r: any) => r.employeeId === emp.id);
    const otherRecord = gen.json.data.find((r: any) => r.employeeId === other.id);

    // DRAFT is not visible to the employee
    const draft = await env.request('GET', `/api/salary/payroll/mine/${myRecord.payrollRecordId}`, { token: empToken.accessToken });
    assert.equal(draft.status, 404);

    const finalized = await env.request('POST', `/api/salary/payroll/${myRecord.payrollRecordId}/finalize`, { token: admin.accessToken });
    assert.equal(finalized.status, 200);

    // Own FINALIZED payslip is visible
    const mine = await env.request('GET', `/api/salary/payroll/mine/${myRecord.payrollRecordId}`, { token: empToken.accessToken });
    assert.equal(mine.status, 200);
    assert.equal(mine.json.data.employee.id, emp.id);
    assert.ok(Array.isArray(mine.json.data.components));

    // Someone else's payslip is never visible (even when finalized)
    await env.request('POST', `/api/salary/payroll/${otherRecord.payrollRecordId}/finalize`, { token: admin.accessToken });
    const foreign = await env.request('GET', `/api/salary/payroll/mine/${otherRecord.payrollRecordId}`, { token: empToken.accessToken });
    assert.equal(foreign.status, 404);

    // Admin-only admin endpoints still reject employees
    const adminList = await env.request('GET', '/api/salary/payroll', { token: empToken.accessToken });
    assert.equal(adminList.status, 403);
  });
});
