import { PrismaClient, Role, EmployeeStatus, LeaveStatus, AttendanceStatus, ComponentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Idempotent: wipe existing data in FK-safe order so the seed can be re-run.
  await prisma.payrollRecordComponent.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.salaryComponent.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  const deptExec = await prisma.department.create({
    data: { name: 'Executive', description: 'Executive leadership' },
  });
  const deptIT = await prisma.department.create({
    data: { name: 'Engineering', description: 'Software engineering and IT operations' },
  });
  const deptHR = await prisma.department.create({
    data: { name: 'Human Resources', description: 'HR and personnel management' },
  });
  const deptSales = await prisma.department.create({
    data: { name: 'Sales', description: 'Sales and business development' },
  });
  const deptFinance = await prisma.department.create({
    data: { name: 'Finance', description: 'Finance and accounting' },
  });

  const emp1 = await prisma.employee.create({
    data: {
      name: 'Alice Anderson',
      email: 'alice@hrpro.com',
      phone: '+1-555-0100',
      departmentId: deptExec.id,
      position: 'CEO',
      hireDate: new Date('2020-01-15'),
      salary: 180000,
      status: EmployeeStatus.Active,
    },
  });

  const emp2 = await prisma.employee.create({
    data: {
      name: 'Bob Brown',
      email: 'bob@hrpro.com',
      phone: '+1-555-0101',
      departmentId: deptHR.id,
      position: 'HR Manager',
      hireDate: new Date('2021-03-01'),
      salary: 85000,
      reportsToId: emp1.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp3 = await prisma.employee.create({
    data: {
      name: 'Charlie Clark',
      email: 'charlie@hrpro.com',
      phone: '+1-555-0102',
      departmentId: deptIT.id,
      position: 'Director of Engineering',
      hireDate: new Date('2021-06-15'),
      salary: 140000,
      reportsToId: emp1.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp4 = await prisma.employee.create({
    data: {
      name: 'Diana Davis',
      email: 'diana@hrpro.com',
      phone: '+1-555-0103',
      departmentId: deptSales.id,
      position: 'VP of Sales',
      hireDate: new Date('2022-02-01'),
      salary: 135000,
      reportsToId: emp1.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp5 = await prisma.employee.create({
    data: {
      name: 'Frank Foster',
      email: 'frank@hrpro.com',
      phone: '+1-555-0104',
      departmentId: deptFinance.id,
      position: 'Finance Manager',
      hireDate: new Date('2022-04-10'),
      salary: 110000,
      reportsToId: emp1.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp6 = await prisma.employee.create({
    data: {
      name: 'Erin Evans',
      email: 'erin@hrpro.com',
      phone: '+1-555-0105',
      departmentId: deptIT.id,
      position: 'Senior Developer',
      hireDate: new Date('2022-08-01'),
      salary: 115000,
      reportsToId: emp3.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp7 = await prisma.employee.create({
    data: {
      name: 'Grace Green',
      email: 'grace@hrpro.com',
      phone: '+1-555-0106',
      departmentId: deptIT.id,
      position: 'QA Engineer',
      hireDate: new Date('2023-01-15'),
      salary: 88000,
      reportsToId: emp3.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp8 = await prisma.employee.create({
    data: {
      name: 'Henry Hill',
      email: 'henry@hrpro.com',
      phone: '+1-555-0107',
      departmentId: deptIT.id,
      position: 'DevOps Engineer',
      hireDate: new Date('2023-03-20'),
      salary: 100000,
      reportsToId: emp3.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp9 = await prisma.employee.create({
    data: {
      name: 'Ivy Ingram',
      email: 'ivy@hrpro.com',
      phone: '+1-555-0108',
      departmentId: deptIT.id,
      position: 'Developer',
      hireDate: new Date('2023-09-01'),
      salary: 82000,
      reportsToId: emp6.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp10 = await prisma.employee.create({
    data: {
      name: 'Jack James',
      email: 'jack@hrpro.com',
      phone: '+1-555-0109',
      departmentId: deptIT.id,
      position: 'Developer',
      hireDate: new Date('2024-01-15'),
      salary: 78000,
      reportsToId: emp6.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp11 = await prisma.employee.create({
    data: {
      name: 'Kate King',
      email: 'kate@hrpro.com',
      phone: '+1-555-0110',
      departmentId: deptHR.id,
      position: 'HR Specialist',
      hireDate: new Date('2022-11-01'),
      salary: 65000,
      reportsToId: emp2.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp12 = await prisma.employee.create({
    data: {
      name: 'Liam Lewis',
      email: 'liam@hrpro.com',
      phone: '+1-555-0111',
      departmentId: deptHR.id,
      position: 'Recruiter',
      hireDate: new Date('2023-05-10'),
      salary: 62000,
      reportsToId: emp2.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp13 = await prisma.employee.create({
    data: {
      name: 'Mia Miller',
      email: 'mia@hrpro.com',
      phone: '+1-555-0112',
      departmentId: deptSales.id,
      position: 'Sales Lead',
      hireDate: new Date('2023-02-15'),
      salary: 92000,
      reportsToId: emp4.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp14 = await prisma.employee.create({
    data: {
      name: 'Noah Nelson',
      email: 'noah@hrpro.com',
      phone: '+1-555-0113',
      departmentId: deptSales.id,
      position: 'Account Executive',
      hireDate: new Date('2023-07-01'),
      salary: 75000,
      reportsToId: emp4.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp15 = await prisma.employee.create({
    data: {
      name: 'Olivia Owen',
      email: 'olivia@hrpro.com',
      phone: '+1-555-0114',
      departmentId: deptSales.id,
      position: 'Account Executive',
      hireDate: new Date('2023-08-15'),
      salary: 75000,
      reportsToId: emp4.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp16 = await prisma.employee.create({
    data: {
      name: 'Peter Porter',
      email: 'peter@hrpro.com',
      phone: '+1-555-0115',
      departmentId: deptSales.id,
      position: 'Sales Development Rep',
      hireDate: new Date('2024-04-01'),
      salary: 58000,
      reportsToId: emp13.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp17 = await prisma.employee.create({
    data: {
      name: 'Quinn Wright',
      email: 'quinn@hrpro.com',
      phone: '+1-555-0116',
      departmentId: deptFinance.id,
      position: 'Financial Analyst',
      hireDate: new Date('2023-10-01'),
      salary: 76000,
      reportsToId: emp5.id,
      status: EmployeeStatus.Active,
    },
  });

  const emp18 = await prisma.employee.create({
    data: {
      name: 'Ryan Reed',
      email: 'ryan@hrpro.com',
      phone: '+1-555-0117',
      departmentId: deptFinance.id,
      position: 'Accountant',
      hireDate: new Date('2024-02-01'),
      salary: 68000,
      reportsToId: emp5.id,
      status: EmployeeStatus.Active,
    },
  });

  await prisma.user.create({
    data: {
      email: 'alice@hrpro.com',
      password: hashedPassword,
      role: Role.Admin,
      employeeId: emp1.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'bob@hrpro.com',
      password: hashedPassword,
      role: Role.HR,
      employeeId: emp2.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'charlie@hrpro.com',
      password: hashedPassword,
      role: Role.Employee,
      employeeId: emp3.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'diana@hrpro.com',
      password: hashedPassword,
      role: Role.Employee,
      employeeId: emp4.id,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.attendance.create({
    data: {
      employeeId: emp1.id,
      date: today,
      checkIn: new Date(today.getTime() + 8 * 3600000),
      status: AttendanceStatus.Present,
    },
  });

  await prisma.attendance.create({
    data: {
      employeeId: emp2.id,
      date: today,
      checkIn: new Date(today.getTime() + 8.5 * 3600000),
      status: AttendanceStatus.Present,
    },
  });

  await prisma.attendance.create({
    data: {
      employeeId: emp4.id,
      date: today,
      checkIn: new Date(today.getTime() + 9 * 3600000),
      status: AttendanceStatus.Present,
    },
  });

  const nextWeekStart = new Date(today);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 3);

  await prisma.leaveRequest.create({
    data: {
      employeeId: emp3.id,
      type: 'Vacation',
      startDate: nextWeekStart,
      endDate: nextWeekEnd,
      reason: 'Family vacation',
      status: LeaveStatus.Pending,
    },
  });

  await prisma.leaveRequest.create({
    data: {
      employeeId: emp4.id,
      type: 'Sick',
      startDate: new Date(today.getTime() + 2 * 86400000),
      endDate: new Date(today.getTime() + 3 * 86400000),
      reason: 'Doctor appointment',
      status: LeaveStatus.Pending,
    },
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  await prisma.salaryStructure.createMany({
    data: [
      { employeeId: emp1.id, baseSalary: 180000, currency: 'USD', effectiveFrom: new Date('2020-01-15') },
      { employeeId: emp2.id, baseSalary: 85000, currency: 'USD', effectiveFrom: new Date('2021-03-01') },
      { employeeId: emp3.id, baseSalary: 140000, currency: 'USD', effectiveFrom: new Date('2021-06-15') },
      { employeeId: emp4.id, baseSalary: 135000, currency: 'USD', effectiveFrom: new Date('2022-02-01') },
    ],
  });

  await prisma.salaryComponent.createMany({
    data: [
      { employeeId: emp1.id, type: ComponentType.ALLOWANCE, label: 'Transport Allowance', amount: 500, isRecurring: true },
      { employeeId: emp1.id, type: ComponentType.BONUS, label: 'Performance Bonus Q2', amount: 5000, isRecurring: false },
      { employeeId: emp2.id, type: ComponentType.ALLOWANCE, label: 'Meal Allowance', amount: 300, isRecurring: true },
      { employeeId: emp3.id, type: ComponentType.INCENTIVE, label: 'Referral Bonus', amount: 2000, isRecurring: false },
      { employeeId: emp4.id, type: ComponentType.BONUS, label: 'Sales Commission', amount: 3500, isRecurring: true },
      { employeeId: emp4.id, type: ComponentType.DEDUCTION, label: 'Health Insurance', amount: 400, isRecurring: true },
    ],
  });

  const net1 = 180000 + 500 + 5000;
  const net2 = 85000 + 300;
  const net3 = 140000 + 2000;
  const net4 = 135000 + 3500 - 400;

  await prisma.payrollRecord.create({
    data: {
      employeeId: emp1.id, month: currentMonth, year: currentYear,
      baseSalary: 180000, totalDeductions: 0, totalIncentives: 0, totalBonuses: 5000,
      netSalary: net1, status: 'FINALIZED', generatedAt: now, finalizedAt: now,
      generatedBy: (await prisma.user.findFirst({ where: { role: 'Admin' } }))!.id,
      components: {
        create: [
          { type: ComponentType.ALLOWANCE, label: 'Transport Allowance', amount: 500 },
          { type: ComponentType.BONUS, label: 'Performance Bonus Q2', amount: 5000 },
        ],
      },
    },
  });

  await prisma.payrollRecord.create({
    data: {
      employeeId: emp2.id, month: currentMonth, year: currentYear,
      baseSalary: 85000, totalDeductions: 0, totalIncentives: 0, totalBonuses: 0,
      netSalary: net2, status: 'FINALIZED', generatedAt: now, finalizedAt: now,
      generatedBy: (await prisma.user.findFirst({ where: { role: 'Admin' } }))!.id,
      components: {
        create: [
          { type: ComponentType.ALLOWANCE, label: 'Meal Allowance', amount: 300 },
        ],
      },
    },
  });

  await prisma.payrollRecord.create({
    data: {
      employeeId: emp3.id, month: currentMonth, year: currentYear,
      baseSalary: 140000, totalDeductions: 0, totalIncentives: 2000, totalBonuses: 0,
      netSalary: net3, status: 'FINALIZED', generatedAt: now, finalizedAt: now,
      generatedBy: (await prisma.user.findFirst({ where: { role: 'Admin' } }))!.id,
      components: {
        create: [
          { type: ComponentType.INCENTIVE, label: 'Referral Bonus', amount: 2000 },
        ],
      },
    },
  });

  await prisma.payrollRecord.create({
    data: {
      employeeId: emp4.id, month: currentMonth, year: currentYear,
      baseSalary: 135000, totalDeductions: 400, totalIncentives: 0, totalBonuses: 3500,
      netSalary: net4, status: 'DRAFT', generatedAt: now,
      generatedBy: (await prisma.user.findFirst({ where: { role: 'Admin' } }))!.id,
      components: {
        create: [
          { type: ComponentType.BONUS, label: 'Sales Commission', amount: 3500 },
          { type: ComponentType.DEDUCTION, label: 'Health Insurance', amount: 400 },
        ],
      },
    },
  });

  console.log('Seed data created successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
