import 'dotenv/config';
import {
  PrismaClient,
  AttendanceStatus,
  LeaveStatus,
  PayrollStatus,
  ComponentType,
  ReviewStatus,
  JobStatus,
  JobType,
  CandidateStatus,
  InterviewStatus,
  InterviewType,
  OnboardingStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

let seedState = 20260815;
function rng() {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 4294967296;
}
function rand(min: number, max: number) {
  return min + rng() * (max - min);
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const DAY = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const ISO = (dt: Date) => dt.toISOString().slice(0, 10);
const YEAR = 2026;
const CURRENT_MONTH = 8;

async function seedShifts(employees: { id: string; shiftId: string | null }[]) {
  const defs = [
    { name: 'Morning', startTime: '08:00', endTime: '16:00', description: 'Standard daytime shift' },
    { name: 'Evening', startTime: '16:00', endTime: '00:00', description: 'Evening coverage shift' },
    { name: 'Night', startTime: '00:00', endTime: '08:00', description: 'Night coverage shift' },
  ];
  const shifts = [];
  for (const d of defs) {
    const existing = await prisma.shift.findUnique({ where: { name: d.name } });
    shifts.push(existing ?? (await prisma.shift.create({ data: d })));
  }
  let assigned = 0;
  for (const [i, emp] of employees.entries()) {
    if (!emp.shiftId) {
      await prisma.employee.update({ where: { id: emp.id }, data: { shiftId: shifts[i % shifts.length].id } });
      assigned++;
    }
  }
  console.log(`[shifts] ensured ${shifts.length}, assigned ${assigned} employees`);
}

async function seedHolidays() {
  const defs: [string, number, number][] = [
    ['New Year\'s Day', 1, 1],
    ['Independence Day', 7, 4],
    ['Labor Day', 9, 7],
    ['Thanksgiving', 11, 26],
    ['Christmas Day', 12, 25],
  ];
  const existing = new Set((await prisma.holiday.findMany({ select: { date: true } })).map((h) => ISO(h.date)));
  const created: string[] = [];
  for (const [name, m, d] of defs) {
    const date = DAY(YEAR, m, d);
    if (!existing.has(ISO(date))) {
      await prisma.holiday.create({ data: { name, date } });
      created.push(name);
    }
  }
  console.log(`[holidays] created ${created.length} (${created.join(', ') || 'none needed'})`);
}

async function seedAttendance(employees: { id: string }[]) {
  const existing = new Set(
    (await prisma.attendance.findMany({ select: { employeeId: true, date: true } })).map((a) => `${a.employeeId}|${ISO(a.date)}`),
  );
  const statuses = [AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Present, AttendanceStatus.Absent, AttendanceStatus.HalfDay];
  const rows: {
    employeeId: string;
    date: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    status: AttendanceStatus;
    overtimeHrs: number;
    notes: string | null;
  }[] = [];
  for (const emp of employees) {
    for (let m = 4; m <= CURRENT_MONTH; m++) {
      const daysInMonth = new Date(YEAR, m, 0).getDate();
      const lastDay = m === CURRENT_MONTH ? 14 : daysInMonth;
      for (let d = 1; d <= lastDay; d++) {
        const date = DAY(YEAR, m, d);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) continue;
        const key = `${emp.id}|${ISO(date)}`;
        if (existing.has(key)) continue;
        const status = pick(statuses);
        const late = rng() < 0.12;
        const checkIn = new Date(YEAR, m - 1, d, late ? 9 + randInt(0, 1) : 8 + randInt(0, 1), late ? randInt(0, 59) : randInt(0, 45));
        const overtime = rng() < 0.1;
        const checkOut = new Date(YEAR, m - 1, d, 17 + randInt(0, 1), randInt(0, 59));
        if (status === AttendanceStatus.Absent) {
          rows.push({ employeeId: emp.id, date, checkIn: null, checkOut: null, status, overtimeHrs: 0, notes: pick(['Sick leave', 'Personal day', null, null]) });
        } else if (status === AttendanceStatus.HalfDay) {
          rows.push({ employeeId: emp.id, date, checkIn, checkOut: null, status, overtimeHrs: 0, notes: 'Half day approved' });
        } else {
          rows.push({
            employeeId: emp.id,
            date,
            checkIn,
            checkOut: overtime ? new Date(checkOut.getTime() + randInt(1, 3) * 60 * 60 * 1000) : checkOut,
            status,
            overtimeHrs: overtime ? 0.5 * randInt(1, 4) : 0,
            notes: late ? 'Arrived late' : null,
          });
        }
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await prisma.attendance.createMany({ data: rows.slice(i, i + 500) });
  }
  console.log(`[attendance] created ${rows.length} records`);
}

async function seedLeaves(employees: { id: string; hireDate: Date }[], adminUserId: string) {
  const existing = new Set(
    (await prisma.leaveRequest.findMany({ select: { employeeId: true, type: true } })).map((l) => `${l.employeeId}|${l.type}`),
  );
  let count = 0;
  for (const emp of employees.slice(0, 12)) {
    if (existing.has(`${emp.id}|Annual`)) continue;
    const annual = [
      { start: DAY(YEAR, 5, 11), end: DAY(YEAR, 5, 15), total: 5, status: LeaveStatus.Approved, reason: 'Family trip', comment: 'Approved by HR' },
      { start: DAY(YEAR, 6, 1), end: DAY(YEAR, 6, 5), total: 5, status: LeaveStatus.Approved, reason: 'Vacation', comment: 'Approved by HR' },
      { start: DAY(YEAR, 8, 24), end: DAY(YEAR, 8, 28), total: 5, status: LeaveStatus.Pending, reason: 'Planned vacation', comment: null },
      { start: DAY(YEAR, 9, 14), end: DAY(YEAR, 9, 16), total: 3, status: LeaveStatus.Pending, reason: 'Personal travel', comment: null },
    ][rng() < 0.3 ? 2 : 0];
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        type: 'Annual',
        startDate: annual.start,
        endDate: annual.end,
        totalDays: annual.total,
        reason: annual.reason,
        status: annual.status,
        reviewComment: annual.comment,
        reviewedBy: annual.comment ? adminUserId : null,
      },
    });
    count++;

    if (rng() < 0.7) {
      const sick = [
        { start: DAY(YEAR, 7, 13), end: DAY(YEAR, 7, 14), total: 2, status: LeaveStatus.Approved, reason: 'Flu', comment: 'Rest and recover' },
        { start: DAY(YEAR, 8, 17), end: DAY(YEAR, 8, 18), total: 2, status: LeaveStatus.Pending, reason: 'Medical appointment', comment: null },
      ][rng() < 0.5 ? 0 : 1];
      await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          type: 'Sick',
          startDate: sick.start,
          endDate: sick.end,
          totalDays: sick.total,
          reason: sick.reason,
          status: sick.status,
          reviewComment: sick.comment,
          reviewedBy: sick.comment ? adminUserId : null,
        },
      });
      count++;
    }

    if (rng() < 0.4) {
      await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          type: 'Annual',
          startDate: DAY(YEAR, 4, 6),
          endDate: DAY(YEAR, 4, 7),
          totalDays: 2,
          reason: 'Family event',
          status: LeaveStatus.Rejected,
          reviewComment: 'Too many approvals that week, please reschedule',
          reviewedBy: adminUserId,
        },
      });
      count++;
    }

    if (rng() < 0.25) {
      await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          type: 'Sick',
          startDate: DAY(YEAR, 3, 9),
          endDate: DAY(YEAR, 3, 10),
          totalDays: 2,
          reason: 'Doctor visit',
          status: LeaveStatus.Approved,
          isCancelled: true,
          cancelledAt: DAY(YEAR, 3, 6),
          cancelReason: 'No longer needed',
          reviewComment: 'Approved by HR',
          reviewedBy: adminUserId,
        },
      });
      count++;
    }
  }
  console.log(`[leaves] created ${count} requests`);
}

async function seedSalaryData(employees: { id: string; salary: number; department: { name: string } | null }) {
  const withStructure = new Set((await prisma.salaryStructure.findMany({ select: { employeeId: true } })).map((s) => s.employeeId));
  let structures = 0;
  for (const emp of employees) {
    if (withStructure.has(emp.id)) continue;
    const base = Math.round((emp.salary / 12) * 100) / 100;
    await prisma.salaryStructure.create({
      data: { employeeId: emp.id, baseSalary: base, currency: 'USD', effectiveFrom: DAY(YEAR, 1, 1) },
    });
    structures++;
  }
  console.log(`[salary] created ${structures} structures (${withStructure.size} existed)`);

  const withComponents = new Set((await prisma.salaryComponent.findMany({ select: { employeeId: true } })).map((c) => c.employeeId));
  let count = 0;
  for (const emp of employees) {
    if (withComponents.has(emp.id)) continue;
    const isSales = emp.department?.name === 'Sales';
    await prisma.salaryComponent.create({ data: { employeeId: emp.id, type: ComponentType.ALLOWANCE, label: 'Housing Allowance', amount: Math.round(rand(300, 1500)), isRecurring: true } });
    await prisma.salaryComponent.create({ data: { employeeId: emp.id, type: ComponentType.ALLOWANCE, label: 'Transport Allowance', amount: Math.round(rand(80, 350)), isRecurring: true } });
    await prisma.salaryComponent.create({ data: { employeeId: emp.id, type: ComponentType.DEDUCTION, label: 'Health Insurance', amount: Math.round(rand(60, 180)), isRecurring: true } });
    if (rng() < 0.5) {
      await prisma.salaryComponent.create({ data: { employeeId: emp.id, type: ComponentType.BONUS, label: 'Performance Bonus', amount: Math.round(rand(500, 4000)), isRecurring: false } });
    }
    if (isSales) {
      await prisma.salaryComponent.create({ data: { employeeId: emp.id, type: ComponentType.INCENTIVE, label: 'Sales Incentive', amount: Math.round(rand(200, 1500)), isRecurring: true } });
    }
    count += isSales ? 5 : 4;
  }
  console.log(`[salary] created ${count} components for ${employees.length - withComponents.size} employees (${withComponents.size} had data)`);
}

async function seedPayroll(employees: { id: string; salary: number }[], adminUserId: string) {
  const monthPlan: { month: number; status: PayrollStatus }[] = [
    { month: 6, status: PayrollStatus.PAID },
    { month: 7, status: PayrollStatus.FINALIZED },
    { month: CURRENT_MONTH, status: PayrollStatus.DRAFT },
  ];
  const existing = new Set((await prisma.payrollRecord.findMany({ select: { employeeId: true, month: true, year: true } })).map((p) => `${p.employeeId}|${p.month}`));
  const allComponents = await prisma.salaryComponent.findMany({ where: { endedAt: null } });
  let count = 0;
  for (const plan of monthPlan) {
    for (const emp of employees) {
      const key = `${emp.id}|${plan.month}`;
      if (existing.has(key)) continue;
      const base = Math.round((emp.salary / 12) * 100) / 100;
      const own = allComponents.filter((c) => c.employeeId === emp.id);
      const recurring = own.filter((c) => c.isRecurring);
      const bonuses = own.filter((c) => c.type === ComponentType.BONUS).reduce((s, c) => s + c.amount, 0);
      const incentives = recurring.filter((c) => c.type === ComponentType.INCENTIVE).reduce((s, c) => s + c.amount, 0);
      const deductions = recurring.filter((c) => c.type === ComponentType.DEDUCTION).reduce((s, c) => s + c.amount, 0);
      const net = Math.round((base + bonuses + incentives - deductions) * 100) / 100;
      const now = new Date();
      const record = await prisma.payrollRecord.create({
        data: {
          employeeId: emp.id,
          month: plan.month,
          year: YEAR,
          baseSalary: base,
          totalDeductions: deductions,
          totalIncentives: incentives,
          totalBonuses: bonuses,
          netSalary: net,
          status: plan.status,
          generatedAt: new Date(now.getTime() - 40 * 86400_000),
          generatedBy: adminUserId,
          finalizedAt: plan.status !== PayrollStatus.DRAFT ? new Date(now.getTime() - 20 * 86400_000) : null,
          finalizedBy: plan.status !== PayrollStatus.DRAFT ? adminUserId : null,
          paidAt: plan.status === PayrollStatus.PAID ? new Date(now.getTime() - 8 * 86400_000) : null,
          paidBy: plan.status === PayrollStatus.PAID ? adminUserId : null,
        },
      });
      await prisma.payrollRecordComponent.createMany({
        data: [
          { payrollRecordId: record.id, type: ComponentType.ALLOWANCE, label: 'Housing Allowance', amount: recurring.filter((c) => c.label === 'Housing Allowance')[0]?.amount ?? 0 },
          { payrollRecordId: record.id, type: ComponentType.ALLOWANCE, label: 'Transport Allowance', amount: recurring.filter((c) => c.label === 'Transport Allowance')[0]?.amount ?? 0 },
          { payrollRecordId: record.id, type: ComponentType.DEDUCTION, label: 'Health Insurance', amount: recurring.filter((c) => c.label === 'Health Insurance')[0]?.amount ?? 0 },
          ...(bonuses ? [{ payrollRecordId: record.id, type: ComponentType.BONUS as const, label: 'Performance Bonus', amount: bonuses }] : []),
          ...(incentives ? [{ payrollRecordId: record.id, type: ComponentType.INCENTIVE as const, label: 'Sales Incentive', amount: incentives }] : []),
        ],
      });
      count++;
    }
  }
  console.log(`[payroll] created ${count} records across ${monthPlan.length} months`);
}

async function seedPerformance(employees: { id: string; reportsToId: string | null }[], adminUserId: string) {
  const count = await prisma.performanceReview.count();
  if (count > 0) {
    console.log('[performance] reviews exist, skipped');
    return;
  }
  const criteria = ['Job Knowledge', 'Communication', 'Teamwork', 'Reliability'];
  const managers = employees.filter((e) => e.reportsToId === null);
  let created = 0;
  for (const emp of employees.slice(0, 8)) {
    const scores = criteria.map((c) => ({ criterion: c, score: randInt(3, 5) }));
    const overall = Math.round((scores.reduce((s, x) => s + x.score, 0) / scores.length) * 10) / 10;
    await prisma.performanceReview.create({
      data: {
        employeeId: emp.id,
        reviewerId: emp.reportsToId ?? managers[0]?.id ?? null,
        periodName: 'H1 2026',
        status: ReviewStatus.COMPLETED,
        criteriaScores: JSON.stringify(scores),
        overallScore: overall,
        strengths: 'Strong execution and reliability. Takes ownership of tasks.',
        improvements: 'Could delegate more and share progress earlier.',
        goals: 'Lead at least one cross-team initiative in H2.',
        reviewComment: 'Solid half-year performance, on track.',
        completedAt: DAY(YEAR, 6, 30),
        completedBy: adminUserId,
      },
    });
    created++;
  }
  await prisma.performanceReview.create({
    data: {
      employeeId: employees[1].id,
      reviewerId: managers[0]?.id ?? null,
      periodName: 'Q3 2026',
      status: ReviewStatus.DRAFT,
      criteriaScores: '[]',
      overallScore: 0,
    },
  });
  console.log(`[performance] created ${created} completed + 1 draft review`);
}

async function seedRecruitment(employees: { id: string }[], adminUserId: string) {
  const jobCount = await prisma.jobPosting.count();
  if (jobCount > 0) {
    console.log('[recruitment] jobs exist, skipped');
    return;
  }
  const departments = await prisma.department.findMany();
  const dept = (name: string) => departments.find((d) => d.name === name)?.id ?? null;
  const eng = dept('Engineering');
  const sales = dept('Sales');
  const hr = dept('Human Resources');

  const jobs = [
    { title: 'Senior Software Engineer', departmentId: eng, type: JobType.FULL_TIME, remote: true, location: 'Remote (US)', slots: 2, salaryMin: 110000, salaryMax: 145000, status: JobStatus.OPEN, description: 'Build and scale the core HR platform.', requirements: '5+ years in TypeScript/Node, cloud experience.', publishedAt: DAY(YEAR, 7, 10) },
    { title: 'Account Executive', departmentId: sales, type: JobType.FULL_TIME, remote: false, location: 'New York, NY', slots: 1, salaryMin: 70000, salaryMax: 95000, status: JobStatus.OPEN, description: 'Own the full sales cycle for mid-market accounts.', requirements: '3+ years B2B SaaS sales.', publishedAt: DAY(YEAR, 7, 15) },
    { title: 'HR Coordinator', departmentId: hr, type: JobType.FULL_TIME, remote: true, location: 'Remote (US)', slots: 1, salaryMin: 48000, salaryMax: 62000, status: JobStatus.OPEN, description: 'Support onboarding, leaves and employee records.', requirements: '1+ year HR or admin experience.', publishedAt: DAY(YEAR, 8, 1) },
    { title: 'DevOps Engineer', departmentId: eng, type: JobType.CONTRACT, remote: true, location: 'Remote (EU)', slots: 0, salaryMin: null, salaryMax: null, status: JobStatus.CLOSED, description: 'AWS infrastructure automation (filled).', requirements: '', publishedAt: DAY(YEAR, 5, 1), closedAt: DAY(YEAR, 6, 30) },
  ];
  for (const j of jobs) {
    await prisma.jobPosting.create({ data: j });
  }

  const candidates = [
    { name: 'Sara Lin', email: 'sara.lin@example.com', phone: '+1-555-0201', source: 'LinkedIn', jobIndex: 0, status: CandidateStatus.INTERVIEW, notes: 'Strong system design background.' },
    { name: 'Tom Becker', email: 'tom.becker@example.com', phone: '+1-555-0202', source: 'Referral', jobIndex: 0, status: CandidateStatus.SCREENING, notes: '' },
    { name: 'Amina Yusuf', email: 'amina.yusuf@example.com', phone: '+1-555-0203', source: 'Job Board', jobIndex: 1, status: CandidateStatus.OFFER, notes: 'Excellent pipeline in previous role.' },
    { name: 'Diego Ramos', email: 'diego.ramos@example.com', phone: '+1-555-0204', source: 'LinkedIn', jobIndex: 2, status: CandidateStatus.NEW, notes: '' },
    { name: 'Priya Nair', email: 'priya.nair@example.com', phone: '+1-555-0205', source: 'Referral', jobIndex: 1, status: CandidateStatus.HIRED, notes: 'Onboarding planned for September.' },
    { name: 'Mark Holt', email: 'mark.holt@example.com', phone: '+1-555-0206', source: 'Job Board', jobIndex: 0, status: CandidateStatus.REJECTED, notes: 'Declined after final round.' },
    { name: 'Lena Fischer', email: 'lena.fischer@example.com', phone: '+1-555-0207', source: 'LinkedIn', jobIndex: 2, status: CandidateStatus.WITHDRAWN, notes: '' },
  ];
  const createdJobs = await prisma.jobPosting.findMany({ where: { title: { in: jobs.map((j) => j.title) } } });
  for (const c of candidates) {
    await prisma.candidate.create({ data: { name: c.name, email: c.email, phone: c.phone, source: c.source, jobId: createdJobs[c.jobIndex]?.id ?? null, status: c.status, notes: c.notes } });
  }

  const candByStatus = await prisma.candidate.findMany();
  const interviewer = employees[1]?.id ?? employees[0].id;
  const interviews = [
    { candidateName: 'Sara Lin', type: InterviewType.PHONE, scheduledAt: DAY(YEAR, 8, 5, 15), durationMin: 45, status: InterviewStatus.COMPLETED, rating: 4, feedback: 'Clear communicator, strong fundamentals. Proceed to technical round.' },
    { candidateName: 'Sara Lin', type: InterviewType.TECHNICAL, scheduledAt: DAY(YEAR, 8, 18, 14), durationMin: 90, status: InterviewStatus.SCHEDULED, rating: null, feedback: null, meetingLink: 'https://meet.example.com/hr-sara' },
    { candidateName: 'Amina Yusuf', type: InterviewType.VIDEO, scheduledAt: DAY(YEAR, 8, 12, 10), durationMin: 60, status: InterviewStatus.COMPLETED, rating: 5, feedback: 'Excellent fit, fast follow-up expected.' },
    { candidateName: 'Tom Becker', type: InterviewType.PHONE, scheduledAt: DAY(YEAR, 8, 3, 11), durationMin: 45, status: InterviewStatus.CANCELLED, rating: null, feedback: null },
  ];
  for (const iv of interviews) {
    const cand = candByStatus.find((c) => c.name === iv.candidateName);
    if (!cand) continue;
    await prisma.interview.create({
      data: {
        candidateId: cand.id,
        jobId: cand.jobId,
        interviewerId: interviewer,
        type: iv.type,
        scheduledAt: iv.scheduledAt,
        durationMin: iv.durationMin,
        status: iv.status,
        rating: iv.rating,
        feedback: iv.feedback,
        meetingLink: iv.meetingLink ?? null,
        createdBy: adminUserId,
      },
    });
  }
  console.log(`[recruitment] ${jobs.length} jobs, ${candidates.length} candidates, ${interviews.length} interviews`);
}

async function seedOnboarding(employees: { id: string; hireDate: Date }[]) {
  const taskCount = await prisma.onboardingTask.count();
  if (taskCount > 0) {
    console.log('[onboarding] tasks exist, skipped');
    return;
  }
  const tasks = [
    { name: 'Welcome Email Sent', category: 'HR', orderIndex: 0 },
    { name: 'Employment Contract Signed', category: 'Legal', orderIndex: 1 },
    { name: 'Company ID & Access Badge', category: 'Security', orderIndex: 2 },
    { name: 'Laptop & Equipment Setup', category: 'IT', orderIndex: 3 },
    { name: 'Email & System Accounts', category: 'IT', orderIndex: 4 },
    { name: 'Benefits Enrollment', category: 'HR', orderIndex: 5 },
    { name: 'First Week Training', category: 'Training', orderIndex: 6 },
  ];
  for (const t of tasks) {
    await prisma.onboardingTask.create({ data: t });
  }
  const allTasks = await prisma.onboardingTask.findMany({ orderBy: { orderIndex: 'asc' } });
  const recent = [...employees].sort((a, b) => b.hireDate.getTime() - a.hireDate.getTime()).slice(0, 5);
  let assignments = 0;
  for (const emp of recent) {
    for (const [i, task] of allTasks.entries()) {
      const done = i < 3 ? true : i === 3 ? emp.hireDate.getTime() < Date.now() - 30 * 86400_000 : false;
      const status = done ? OnboardingStatus.COMPLETED : i === 3 ? OnboardingStatus.IN_PROGRESS : OnboardingStatus.PENDING;
      await prisma.onboardingAssignment.create({
        data: {
          employeeId: emp.id,
          taskId: task.id,
          status,
          dueDate: new Date(emp.hireDate.getTime() + 14 * 86400_000),
          completedAt: done ? new Date(emp.hireDate.getTime() + i * 86400_000) : null,
          notes: done ? 'Done' : '',
        },
      });
      assignments++;
    }
  }
  console.log(`[onboarding] ${tasks.length} tasks, ${assignments} assignments for ${recent.length} recent hires`);
}

async function seedNotifications(users: { id: string; email: string }[]) {
  await prisma.notification.deleteMany();
  const byEmail = (email: string) => users.find((u) => u.email === email)?.id;
  const rows: { userId: string; message: string; type: string; link: string; read: boolean; createdAt: Date }[] = [];
  const adminId = byEmail('alice@hrpro.com');
  const hrId = byEmail('bob@hrpro.com');
  const empId = byEmail('charlie@hrpro.com') ?? byEmail('diana@hrpro.com');
  if (adminId) {
    rows.push({ userId: adminId, message: 'Payroll for July has been finalized. 18 records ready to pay.', type: 'success', link: '/salary/payroll', read: false, createdAt: DAY(YEAR, 8, 1) });
    rows.push({ userId: adminId, message: '5 leave requests are awaiting review.', type: 'warning', link: '/leaves', read: true, createdAt: DAY(YEAR, 8, 10) });
  }
  if (hrId) {
    rows.push({ userId: hrId, message: 'New candidate applied for Senior Software Engineer.', type: 'info', link: '/recruitment', read: false, createdAt: DAY(YEAR, 8, 12) });
    rows.push({ userId: hrId, message: '3 onboarding tasks are due this week.', type: 'warning', link: '/onboarding', read: true, createdAt: DAY(YEAR, 8, 13) });
  }
  if (empId) {
    rows.push({ userId: empId, message: 'Your leave request was approved.', type: 'success', link: '/leaves', read: false, createdAt: DAY(YEAR, 8, 6) });
  }
  await prisma.notification.createMany({ data: rows });
  console.log(`[notifications] created ${rows.length}`);
}

async function main() {
  const employees = await prisma.employee.findMany({ include: { department: true } });
  const users = await prisma.user.findMany();
  if (employees.length === 0) throw new Error('No employees found - run `npm run prisma:seed` first');
  const adminUser = users.find((u) => u.role === 'Admin') ?? users[0];

  console.log(`Seeding demo data for ${employees.length} employees, ${users.length} users...`);
  await seedShifts(employees);
  await seedHolidays();
  await seedAttendance(employees);
  await seedLeaves(employees, adminUser.id);
  await seedSalaryData(employees);
  await seedPayroll(employees, adminUser.id);
  await seedPerformance(employees, adminUser.id);
  await seedRecruitment(employees, adminUser.id);
  await seedOnboarding(employees);
  await seedNotifications(users);
  console.log('Demo data seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
