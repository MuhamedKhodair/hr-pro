-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "baseSalary" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryComponent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendancePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lateDeductionRule" TEXT NOT NULL DEFAULT '0',
    "absenceDeductionRule" TEXT NOT NULL DEFAULT 'full_day',
    "halfDayRule" TEXT NOT NULL DEFAULT 'half_day',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" REAL NOT NULL,
    "totalDeductions" REAL NOT NULL DEFAULT 0,
    "totalIncentives" REAL NOT NULL DEFAULT 0,
    "totalBonuses" REAL NOT NULL DEFAULT 0,
    "netSalary" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedAt" DATETIME,
    "finalizedAt" DATETIME,
    "paidAt" DATETIME,
    "generatedBy" TEXT,
    "finalizedBy" TEXT,
    "paidBy" TEXT,
    "adjustment" REAL NOT NULL DEFAULT 0,
    "adjustmentReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollRecordComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollRecordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollRecordComponent_payrollRecordId_fkey" FOREIGN KEY ("payrollRecordId") REFERENCES "PayrollRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SalaryStructure_employeeId_idx" ON "SalaryStructure"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryComponent_employeeId_idx" ON "SalaryComponent"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollRecord_employeeId_month_year_idx" ON "PayrollRecord"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_employeeId_month_year_key" ON "PayrollRecord"("employeeId", "month", "year");
