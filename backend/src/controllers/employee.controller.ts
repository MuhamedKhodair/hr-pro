import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as employeeService from '../services/employee.service';
import * as onboardingService from '../services/onboarding.service';
import { logAudit } from '../services/audit.service';
import { toCsv, csvResponse } from '../lib/csv';
import { excelResponse } from '../lib/excel';
import { z } from 'zod';

export async function getAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'Employee') {
      if (!req.user.employeeId) return res.json({ success: true, data: [] });
      const employee = await employeeService.getById(req.user.employeeId);
      return res.json({ success: true, data: [employee] });
    }
    const { page, pageSize, search } = req.query as { page?: string; pageSize?: string; search?: string };
    if (page || pageSize) {
      const p = Math.max(parseInt(page || '1', 10) || 1, 1);
      const ps = Math.min(Math.max(parseInt(pageSize || '20', 10) || 20, 1), 100);
      const result = await employeeService.getAllPaginated({ page: p, pageSize: ps, search });
      return res.json({ success: true, data: result });
    }
    const employees = await employeeService.getAll();
    res.json({ success: true, data: employees });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'Employee' && req.user.employeeId !== String(req.params.id)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const employee = await employeeService.getById(String(req.params.id));
    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.employeeId) return res.status(400).json({ success: false, error: 'No employee profile linked to your account' });
    const employee = await employeeService.getMe(req.user.employeeId);
    res.json({
      success: true,
      data: {
        ...employee,
        documents: employee.documents.map((d) => ({
          ...d,
          url: `/api/uploads/files/employee-documents/${d.fileName}`,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.employeeId) return res.status(400).json({ success: false, error: 'No employee profile linked to your account' });
    const data = employeeService.updateMeSchema.parse(req.body);
    const employee = await employeeService.updateMe(req.user.employeeId, data);
    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = employeeService.createEmployeeSchema.parse(req.body);
    const employee = await employeeService.create(data);
    await onboardingService.generateAssignments(employee.id).catch(() => {});
    await logAudit(req, { action: 'EMPLOYEE_CREATED', entity: 'Employee', entityId: employee.id, details: employee.email });
    res.status(201).json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = employeeService.updateEmployeeSchema.parse(req.body);
    const employee = await employeeService.update(String(req.params.id), data);
    await logAudit(req, { action: 'EMPLOYEE_UPDATED', entity: 'Employee', entityId: employee.id, details: employee.email });
    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const employee = await employeeService.getById(id);
    await employeeService.remove(id);
    await logAudit(req, { action: 'EMPLOYEE_DELETED', entity: 'Employee', entityId: id, details: employee.email });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function orgChart(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tree = await employeeService.getOrgTree();
    res.json({ success: true, data: tree });
  } catch (err) {
    next(err);
  }
}

const bulkImportBodySchema = z.object({
  rows: z.array(employeeService.importEmployeeSchema).min(1).max(500),
});

export async function bulkImport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { rows } = bulkImportBodySchema.parse(req.body);
    const result = await employeeService.bulkImport(rows);
    await logAudit(req, {
      action: 'EMPLOYEES_BULK_IMPORT',
      entity: 'Employee',
      details: `${result.created} created, ${result.skipped} skipped, ${result.errors} errors`,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function exportExcel(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employees = await employeeService.getAll();
    const rows = employees.map((e) => ({
      Name: e.name,
      Email: e.email,
      Phone: e.phone ?? '',
      Department: e.department?.name ?? '',
      Position: e.position,
      'Hire Date': new Date(e.hireDate).toISOString().split('T')[0],
      Salary: e.salary,
      Status: e.status,
      'Reports To': e.manager?.name ?? '',
    }));
    await excelResponse(
      res,
      `employees-${new Date().toISOString().split('T')[0]}.xlsx`,
      'Employees',
      [
        { header: 'Name', key: 'Name', width: 24 },
        { header: 'Email', key: 'Email', width: 30 },
        { header: 'Phone', key: 'Phone', width: 18 },
        { header: 'Department', key: 'Department', width: 20 },
        { header: 'Position', key: 'Position', width: 22 },
        { header: 'Hire Date', key: 'Hire Date', width: 14 },
        { header: 'Salary', key: 'Salary', width: 14 },
        { header: 'Status', key: 'Status', width: 12 },
        { header: 'Reports To', key: 'Reports To', width: 24 },
      ],
      rows,
    );
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employees = await employeeService.getAll();
    const headers = ['Name', 'Email', 'Phone', 'Department', 'Position', 'Hire Date', 'Salary', 'Status', 'Reports To'];
    const rows = employees.map((e) => [
      e.name,
      e.email,
      e.phone ?? '',
      e.department?.name ?? '',
      e.position,
      e.hireDate.toISOString().split('T')[0],
      e.salary,
      e.status,
      e.manager?.name ?? '',
    ]);
    csvResponse(res, `employees-${new Date().toISOString().split('T')[0]}.csv`, toCsv(headers, rows));
  } catch (err) {
    next(err);
  }
}

export async function exportTemplate(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await excelResponse(
      res,
      'employee-import-template.xlsx',
      'Employees',
      [
        { header: 'Name', key: 'name', width: 24 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Phone', key: 'phone', width: 18 },
        { header: 'Department', key: 'department', width: 18 },
        { header: 'Position', key: 'position', width: 22 },
        { header: 'Hire Date', key: 'hireDate', width: 14 },
        { header: 'Salary', key: 'salary', width: 12 },
        { header: 'Manager Email', key: 'managerEmail', width: 28 },
      ],
      [
        {
          name: 'John Smith',
          email: 'john.smith@example.com',
          phone: '+1 555 0100',
          department: 'Engineering',
          position: 'Software Engineer',
          hireDate: '2026-01-05',
          salary: 2500,
          managerEmail: 'alice@hrpro.com',
        },
      ],
    );
  } catch (err) {
    next(err);
  }
}
