-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'HR Pro',
    "companyTagline" TEXT NOT NULL DEFAULT '',
    "logoPath" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#4756d7',
    "annualLeaveEntitlement" REAL NOT NULL DEFAULT 21,
    "sickLeaveEntitlement" REAL NOT NULL DEFAULT 15,
    "vacationMaxDaysPerRequest" REAL NOT NULL DEFAULT 21,
    "sickMaxDaysPerRequest" REAL NOT NULL DEFAULT 15,
    "unpaidMaxDaysPerRequest" REAL NOT NULL DEFAULT 30,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "workingDays" TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    "weekStartsOn" TEXT NOT NULL DEFAULT 'Mon',
    "lateThresholdMinutes" INTEGER NOT NULL DEFAULT 15,
    "standardWorkHours" REAL NOT NULL DEFAULT 8,
    "overtimeRateMultiplier" REAL NOT NULL DEFAULT 1.5,
    "allowPublicRegistration" BOOLEAN NOT NULL DEFAULT false,
    "registrationWhitelist" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Setting" ("annualLeaveEntitlement", "companyName", "companyTagline", "currency", "currencySymbol", "fiscalYearStartMonth", "id", "lateThresholdMinutes", "logoPath", "overtimeRateMultiplier", "primaryColor", "sickLeaveEntitlement", "sickMaxDaysPerRequest", "standardWorkHours", "unpaidMaxDaysPerRequest", "updatedAt", "vacationMaxDaysPerRequest", "weekStartsOn", "workingDays") SELECT "annualLeaveEntitlement", "companyName", "companyTagline", "currency", "currencySymbol", "fiscalYearStartMonth", "id", "lateThresholdMinutes", "logoPath", "overtimeRateMultiplier", "primaryColor", "sickLeaveEntitlement", "sickMaxDaysPerRequest", "standardWorkHours", "unpaidMaxDaysPerRequest", "updatedAt", "vacationMaxDaysPerRequest", "weekStartsOn", "workingDays" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
