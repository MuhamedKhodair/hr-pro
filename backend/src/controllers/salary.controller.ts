import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as salaryService from '../services/salary.service';

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
    const { month, year, employeeId } = req.query as { month?: string; year?: string; employeeId?: string };
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
