import { describe, before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnv, hashPassword, loginAs, TestEnv } from './helpers';

let env: TestEnv;
let admin: { user: any; accessToken: string; refreshToken: string };
let interviewer: { user: any; accessToken: string; refreshToken: string };
let otherEmployee: { user: any; accessToken: string; refreshToken: string };
let jobId: string;
let candId: string;
let interviewId: string;

before(async () => {
  env = await startTestEnv('test-recruitment.db');
  const dept = await env.prisma.department.create({ data: { name: 'Eng' } });

  const adminPwd = await hashPassword('admin123');
  await env.prisma.user.create({ data: { email: 'rec.admin@hrpro.com', password: adminPwd, role: 'Admin' } });

  const emp = await env.prisma.employee.create({
    data: { name: 'Hiring Mgr', email: 'hiring@hrpro.com', position: 'Lead', departmentId: dept.id, hireDate: new Date('2025-01-01'), status: 'Active', salary: 5000 },
  });
  const interviewerPwd = await hashPassword('int12345');
  await env.prisma.user.create({ data: { email: 'interviewer@hrpro.com', password: interviewerPwd, role: 'Employee', employeeId: emp.id } });

  const emp2 = await env.prisma.employee.create({
    data: { name: 'Other', email: 'other@hrpro.com', position: 'Dev', departmentId: dept.id, hireDate: new Date('2025-02-01'), status: 'Active', salary: 3000 },
  });
  const otherPwd = await hashPassword('other123');
  await env.prisma.user.create({ data: { email: 'other.emp@hrpro.com', password: otherPwd, role: 'Employee', employeeId: emp2.id } });

  admin = await loginAs(env, 'rec.admin@hrpro.com', 'admin123');
  interviewer = await loginAs(env, 'interviewer@hrpro.com', 'int12345');
  otherEmployee = await loginAs(env, 'other.emp@hrpro.com', 'other123');
});

after(async () => {
  await env.close();
});

describe('jobs', () => {
  test('create job posting', async () => {
    const res = await env.request('POST', '/api/recruitment/jobs', {
      token: admin.accessToken,
      body: { title: 'Senior Dev', type: 'FULL_TIME', slots: 2, salaryMin: 60000, salaryMax: 80000, description: 'Build things', requirements: 'TS' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.status, 'DRAFT');
    jobId = res.json.data.id;
  });

  test('list jobs and filter by status', async () => {
    const res = await env.request('GET', '/api/recruitment/jobs', { token: admin.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.total, 1);

    const filtered = await env.request('GET', '/api/recruitment/jobs?status=OPEN', { token: admin.accessToken });
    assert.equal(filtered.json.data.total, 0);
  });

  test('publish then close job', async () => {
    const pub = await env.request('PATCH', `/api/recruitment/jobs/${jobId}/status`, { token: admin.accessToken, body: { status: 'OPEN' } });
    assert.equal(pub.status, 200);
    assert.equal(pub.json.data.status, 'OPEN');
    assert.ok(pub.json.data.publishedAt);

    const closed = await env.request('PATCH', `/api/recruitment/jobs/${jobId}/status`, { token: admin.accessToken, body: { status: 'CLOSED' } });
    assert.equal(closed.json.data.status, 'CLOSED');
    assert.ok(closed.json.data.closedAt);
  });

  test('reject invalid job status', async () => {
    const res = await env.request('PATCH', `/api/recruitment/jobs/${jobId}/status`, { token: admin.accessToken, body: { status: 'BOGUS' } });
    assert.equal(res.status, 400);
  });

  test('employees cannot manage jobs', async () => {
    const res = await env.request('POST', '/api/recruitment/jobs', { token: interviewer.accessToken, body: { title: 'Nope', type: 'FULL_TIME', slots: 1 } });
    assert.equal(res.status, 403);
  });
});

describe('candidates', () => {
  test('create candidate', async () => {
    const res = await env.request('POST', '/api/recruitment/candidates', {
      token: admin.accessToken,
      body: { name: 'Jane Doe', email: 'jane@example.com', phone: '+123', source: 'LinkedIn', jobId, notes: 'Strong TS' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.status, 'NEW');
    candId = res.json.data.id;
  });

  test('list candidates with job filter', async () => {
    const res = await env.request('GET', `/api/recruitment/candidates?jobId=${jobId}`, { token: admin.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.total, 1);
    assert.equal(res.json.data.data[0].job.title, 'Senior Dev');
  });

  test('delete job blocked when candidates exist', async () => {
    const del = await env.request('DELETE', `/api/recruitment/jobs/${jobId}`, { token: admin.accessToken });
    assert.equal(del.status, 400);
  });

  test('move candidate through the pipeline', async () => {
    for (const status of ['SCREENING', 'INTERVIEW', 'OFFER']) {
      const res = await env.request('PATCH', `/api/recruitment/candidates/${candId}/status`, { token: admin.accessToken, body: { status } });
      assert.equal(res.status, 200);
      assert.equal(res.json.data.status, status);
    }
  });

  test('offers list only after reaching OFFER', async () => {
    const res = await env.request('GET', '/api/recruitment/candidates?status=OFFER', { token: admin.accessToken });
    assert.equal(res.json.data.total, 1);
  });

  test('employees cannot list candidates', async () => {
    const res = await env.request('GET', '/api/recruitment/candidates', { token: interviewer.accessToken });
    assert.equal(res.status, 403);
  });
});

describe('interviews', () => {
  test('schedule interview and notify interviewer', async () => {
    const res = await env.request('POST', '/api/recruitment/interviews', {
      token: admin.accessToken,
      body: {
        candidateId: candId,
        jobId,
        interviewerId: interviewer.user.employeeId,
        type: 'TECHNICAL',
        scheduledAt: '2026-08-20T10:00:00.000Z',
        durationMin: 60,
        meetingLink: 'https://meet.example.com/abc',
      },
    });
    assert.equal(res.status, 201);
    interviewId = res.json.data.id;

    const notif = await env.prisma.notification.findFirst({ where: { userId: interviewer.user.id, type: 'recruitment' } });
    assert.ok(notif, 'interviewer should be notified');
  });

  test('interviewer sees only their interviews', async () => {
    const res = await env.request('GET', '/api/recruitment/interviews', { token: interviewer.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.total, 1);
  });

  test('non-interviewer employee gets 403 on feedback', async () => {
    const res = await env.request('POST', `/api/recruitment/interviews/${interviewId}/feedback`, {
      token: otherEmployee.accessToken,
      body: { rating: 4, feedback: 'fine' },
    });
    assert.equal(res.status, 403);
  });

  test('interviewer submits feedback', async () => {
    const res = await env.request('POST', `/api/recruitment/interviews/${interviewId}/feedback`, {
      token: interviewer.accessToken,
      body: { rating: 5, feedback: 'Excellent technical skills' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.status, 'COMPLETED');
    assert.equal(res.json.data.rating, 5);
  });

  test('completed interview cannot be cancelled', async () => {
    const res = await env.request('PATCH', `/api/recruitment/interviews/${interviewId}/cancel`, { token: admin.accessToken });
    assert.equal(res.status, 400);
  });

  test('candidate delete cascades interviews', async () => {
    const res = await env.request('DELETE', `/api/recruitment/candidates/${candId}`, { token: admin.accessToken });
    assert.equal(res.status, 200);
    const left = await env.prisma.interview.count({ where: { id: interviewId } });
    assert.equal(left, 0);
  });

  test('job deletable once no candidates remain', async () => {
    const del = await env.request('DELETE', `/api/recruitment/jobs/${jobId}`, { token: admin.accessToken });
    assert.equal(del.status, 200);
  });
});

describe('stats', () => {
  test('recruitment stats return funnel counts', async () => {
    const res = await env.request('GET', '/api/recruitment/stats', { token: admin.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.openJobs, 0);
    assert.ok(Array.isArray(res.json.data.byStatus));
  });
});