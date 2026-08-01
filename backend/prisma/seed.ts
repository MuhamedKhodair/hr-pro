import { PrismaClient, Role, EmployeeStatus, LeaveStatus, AttendanceStatus, ComponentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const deptIT = await prisma.department.create({
    data: { name: 'Engineering', description: 'Software engineering and IT operations' },
  });
  const deptHR = await prisma.department.create({
    data: { name: 'Human Resources', description: 'HR and personnel management' },
  });
  const deptSales = await prisma.department.create({
    data: { name: 'Sales', description: 'Sales and business development' },
  });

  const emp1 = await prisma.employee.create({
    data: {
      name: 'Alice Admin',
      email: 'alice@hrpro.com',
      phone: '+1-555-0100',
      departmentId: deptIT.id,
      position: 'CTO',
      hireDate: new Date('2020-01-15'),
      salary: 150000,
      status: EmployeeStatus.Active,
    },
  });

  const emp2 = await prisma.employee.create({
    data: {
      name: 'Bob HR',
      email: 'bob@hrpro.com',
      phone: '+1-555-0101',
      departmentId: deptHR.id,
      position: 'HR Manager',
      hireDate: new Date('2021-03-01'),
      salary: 85000,
      status: EmployeeStatus.Active,
    },
  });

  const emp3 = await prisma.employee.create({
    data: {
      name: 'Charlie Dev',
      email: 'charlie@hrpro.com',
      phone: '+1-555-0102',
      departmentId: deptIT.id,
      position: 'Senior Developer',
      hireDate: new Date('2022-06-15'),
      salary: 120000,
      status: EmployeeStatus.Active,
    },
  });

  const emp4 = await prisma.employee.create({
    data: {
      name: 'Diana Sales',
      email: 'diana@hrpro.com',
      phone: '+1-555-0103',
      departmentId: deptSales.id,
      position: 'Sales Lead',
      hireDate: new Date('2023-02-01'),
      salary: 95000,
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
      { employeeId: emp1.id, baseSalary: 150000, currency: 'USD', effectiveFrom: new Date('2020-01-15') },
      { employeeId: emp2.id, baseSalary: 85000, currency: 'USD', effectiveFrom: new Date('2021-03-01') },
      { employeeId: emp3.id, baseSalary: 120000, currency: 'USD', effectiveFrom: new Date('2022-06-15') },
      { employeeId: emp4.id, baseSalary: 95000, currency: 'USD', effectiveFrom: new Date('2023-02-01') },
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

  const net1 = 150000 + 500 + 5000;
  const net2 = 85000 + 300;
  const net3 = 120000 + 2000;
  const net4 = 95000 + 3500 - 400;

  await prisma.payrollRecord.create({
    data: {
      employeeId: emp1.id, month: currentMonth, year: currentYear,
      baseSalary: 150000, totalDeductions: 0, totalIncentives: 0, totalBonuses: 5000,
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
      baseSalary: 120000, totalDeductions: 0, totalIncentives: 2000, totalBonuses: 0,
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
      baseSalary: 95000, totalDeductions: 400, totalIncentives: 0, totalBonuses: 3500,
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
