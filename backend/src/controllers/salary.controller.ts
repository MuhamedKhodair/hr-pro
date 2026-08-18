import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as salaryService from '../services/salary.service';
import { logAudit } from '../services/audit.service';
import { notifyRole } from '../services/notification.service';
import { toCsv, csvResponse } from '../lib/csv';
import { excelResponse } from '../lib/excel';

export async function createOrUpdateStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = salaryService.createSalaryStructureSchema.parse(req.body);
    const result = await salaryService.createOrUpdateSalaryStructure(data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getStructure(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.getSalaryStructure(String(req.params.employeeId));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getStructureHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.getSalaryStructureHistory(String(req.params.employeeId));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listAllStructures(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.getAllSalaryStructures();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createComponent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = salaryService.createSalaryComponentSchema.parse(req.body);
    const result = await salaryService.createSalaryComponent(data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getAllActiveComponents(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.getAllActiveComponents();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getComponents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { activeOnly } = req.query as { activeOnly?: string };
    const result = await salaryService.getSalaryComponents(
      String(req.params.employeeId),
      activeOnly !== 'false',
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function removeComponent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await salaryService.deleteSalaryComponent(String(req.params.id));
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function generatePayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = salaryService.generatePayrollSchema.parse(req.body);
    const userId = req.user!.userId;

    let employeeIds = data.employeeIds || [];

    if (data.allEmployees) {
      const employees = await salaryService.getAllEmployees();
      employeeIds = employees.map((e) => e.id);
    } else if (data.departmentId) {
      const employees = await salaryService.getAllEmployees();
      employeeIds = employees.filter((e) => e.departmentId === data.departmentId).map((e) => e.id);
    }

    if (employeeIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No employees selected' });
    }

    const results = await salaryService.generatePayroll(employeeIds, data.month, data.year, userId);
    await logAudit(req, {
      action: 'PAYROLL_GENERATED',
      entity: 'PayrollRecord',
      details: `${data.month}/${data.year} for ${results.filter((r) => r.payrollRecordId).length} employees`,
    });
    const createdCount = results.filter((r) => r.payrollRecordId).length;
    if (createdCount > 0) {
      await notifyRole(
        'Admin',
        `Payroll for ${data.month}/${data.year} is ready to review (${createdCount} records)`,
        'payroll_generated',
        '/salary',
      );
    }
    res.status(201).json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function previewPayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = String(req.query.employeeId || '');
    const month = parseInt(String(req.query.month || '0'));
    const year = parseInt(String(req.query.year || '0'));
    const result = await salaryService.previewPayroll(employeeId, month, year);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getPayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = req.params.employeeId as string;
    const month = parseInt(req.params.month as string);
    const year = parseInt(req.params.year as string);
    const result = await salaryService.getPayrollRecord(employeeId, month, year);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getPayrollById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.getPayrollRecordById(String(req.params.id));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function adjustPayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = salaryService.adjustPayrollSchema.parse(req.body);
    const result = await salaryService.adjustPayroll(String(req.params.id), data.adjustment, data.adjustmentReason);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function finalizePayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.finalizePayroll(String(req.params.id), req.user!.userId);
    await logAudit(req, {
      action: 'PAYROLL_FINALIZED',
      entity: 'PayrollRecord',
      entityId: result.id,
      details: `${result.month}/${result.year}`,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function markPayrollPaid(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.markPayrollPaid(String(req.params.id), req.user!.userId);
    await logAudit(req, {
      action: 'PAYROLL_PAID',
      entity: 'PayrollRecord',
      entityId: result.id,
      details: `${result.month}/${result.year}`,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getPayrollSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const month = parseInt(String(req.query.month));
    const year = parseInt(String(req.query.year));
    const result = await salaryService.getPayrollSummary(month, year);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listPayrolls(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month, year, employeeId, status, page, pageSize } = req.query as Record<string, string>;
    if (page || pageSize) {
      const p = Math.max(parseInt(page || '1', 10) || 1, 1);
      const ps = Math.min(Math.max(parseInt(pageSize || '20', 10) || 20, 1), 100);
      const result = await salaryService.listPayrollRecordsPaginated({
        page: p,
        pageSize: ps,
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
        employeeId,
        status,
      });
      return res.json({ success: true, data: result });
    }
    const result = await salaryService.listPayrollRecords(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
      employeeId,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function myPayroll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.employeeId) return res.status(400).json({ success: false, error: 'No employee profile linked to your account' });
    const { month, year } = req.query as Record<string, string>;
    const result = await salaryService.listPayrollRecords(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
      req.user.employeeId,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function myPayrollDetail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.employeeId) return res.status(400).json({ success: false, error: 'No employee profile linked to your account' });
    const record = await salaryService.getOwnPayrollRecord(req.user.employeeId, String(req.params.id));
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

export async function getPayrollTrend(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.getPayrollTrend();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getEmployees(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await salaryService.getAllEmployees();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function exportPayrollExcel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.query as { month?: string; year?: string };
    const records = await salaryService.listPayrollRecords(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    );
    const rows = records.map((r) => ({
      Employee: r.employee.name,
      Department: r.employee.department?.name ?? '',
      Month: r.month,
      Year: r.year,
      'Base Salary': r.baseSalary,
      Deductions: r.totalDeductions,
      Incentives: r.totalIncentives,
      Bonuses: r.totalBonuses,
      'Net Salary': r.netSalary,
      Status: r.status,
    }));
    await excelResponse(
      res,
      `payroll-${year || 'all'}-${month || 'all'}.xlsx`,
      'Payroll',
      [
        { header: 'Employee', key: 'Employee', width: 24 },
        { header: 'Department', key: 'Department', width: 20 },
        { header: 'Month', key: 'Month', width: 10 },
        { header: 'Year', key: 'Year', width: 10 },
        { header: 'Base Salary', key: 'Base Salary', width: 14 },
        { header: 'Deductions', key: 'Deductions', width: 14 },
        { header: 'Incentives', key: 'Incentives', width: 14 },
        { header: 'Bonuses', key: 'Bonuses', width: 14 },
        { header: 'Net Salary', key: 'Net Salary', width: 14 },
        { header: 'Status', key: 'Status', width: 12 },
      ],
      rows,
    );
  } catch (err) {
    next(err);
  }
}

export async function exportPayrollCsv(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.query as { month?: string; year?: string };
    const records = await salaryService.listPayrollRecords(
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    );
    const headers = ['Employee', 'Department', 'Month', 'Year', 'Base Salary', 'Deductions', 'Incentives', 'Bonuses', 'Net Salary', 'Status'];
    const rows = records.map((r) => [
      r.employee.name,
      r.employee.department?.name ?? '',
      r.month,
      r.year,
      r.baseSalary,
      r.totalDeductions,
      r.totalIncentives,
      r.totalBonuses,
      r.netSalary,
      r.status,
    ]);
    csvResponse(res, `payroll-${year || 'all'}-${month || 'all'}.csv`, toCsv(headers, rows));
  } catch (err) {
    next(err);
  }
}
