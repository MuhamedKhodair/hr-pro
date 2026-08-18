import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as attendanceService from '../services/attendance.service';
import { logAudit } from '../services/audit.service';
import { toCsv, csvResponse } from '../lib/csv';
import { excelResponse } from '../lib/excel';
import { z } from 'zod';

export async function getToday(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const isEmployee = req.user?.role === 'Employee';
    if (isEmployee) {
      const records = await attendanceService.getToday(req.user!.employeeId!);
      return res.json({ success: true, data: records });
    }
    const employeeId = req.query.employeeId as string | undefined;
    const records = await attendanceService.getToday(employeeId);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
}

export async function checkIn(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let { employeeId } = attendanceService.checkInSchema.parse(req.body);
    if (req.user?.role === 'Employee') {
      employeeId = req.user.employeeId!;
    }
    const record = await attendanceService.checkIn(employeeId);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let { employeeId } = attendanceService.checkInSchema.parse(req.body);
    if (req.user?.role === 'Employee') {
      employeeId = req.user.employeeId!;
    }
    const record = await attendanceService.checkOut(employeeId);
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

export async function getDateRange(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { start, end, employeeId } = req.query as {
      start: string;
      end: string;
      employeeId?: string;
    };
    if (!start || !end) {
      return res.status(400).json({ success: false, error: 'start and end are required' });
    }
    const scopedId = req.user?.role === 'Employee' ? req.user.employeeId! : employeeId;
    const records = await attendanceService.getDateRange(scopedId, start, end);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
}

export async function getMonthly(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = String(req.params.employeeId);
    if (req.user?.role === 'Employee' && req.user.employeeId !== employeeId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const year = String(req.params.year);
    const month = String(req.params.month);
    const records = await attendanceService.getMonthly(employeeId, parseInt(year), parseInt(month));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
}

const bulkImportBodySchema = z.object({
  rows: z.array(attendanceService.bulkImportRowSchema).min(1).max(1000),
});

export async function bulkImport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { rows } = bulkImportBodySchema.parse(req.body);
    const result = await attendanceService.bulkImport(rows);
    await logAudit(req, {
      action: 'ATTENDANCE_BULK_IMPORT',
      entity: 'Attendance',
      details: `${result.created} created, ${result.updated} updated, ${result.errors} errors`,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function manualEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = attendanceService.manualEntrySchema.parse(req.body);
    const record = await attendanceService.manualEntry(data);
    await logAudit(req, {
      action: 'ATTENDANCE_MANUAL_ENTRY',
      entity: 'Attendance',
      entityId: record.id,
      details: `Employee ${record.employee.name} on ${new Date(record.date).toISOString().split('T')[0]}`,
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

export async function exportExcel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { start, end } = req.query as { start: string; end: string };
    if (!start || !end) {
      return res.status(400).json({ success: false, error: 'start and end are required' });
    }
    const records = await attendanceService.getDateRange(undefined, start, end);
    const rows = records.map((a) => ({
      Employee: a.employee.name,
      Email: a.employee.email,
      Date: new Date(a.date).toISOString().split('T')[0],
      'Check In': a.checkIn ? new Date(a.checkIn).toISOString() : '',
      'Check Out': a.checkOut ? new Date(a.checkOut).toISOString() : '',
      Status: a.status,
      'Overtime (hrs)': a.overtimeHrs,
      Notes: a.notes ?? '',
    }));
    await excelResponse(
      res,
      `attendance-${start}-to-${end}.xlsx`,
      'Attendance',
      [
        { header: 'Employee', key: 'Employee', width: 24 },
        { header: 'Email', key: 'Email', width: 30 },
        { header: 'Date', key: 'Date', width: 14 },
        { header: 'Check In', key: 'Check In', width: 20 },
        { header: 'Check Out', key: 'Check Out', width: 20 },
        { header: 'Status', key: 'Status', width: 12 },
        { header: 'Overtime (hrs)', key: 'Overtime (hrs)', width: 14 },
        { header: 'Notes', key: 'Notes', width: 28 },
      ],
      rows,
    );
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { start, end } = req.query as { start: string; end: string };
    if (!start || !end) {
      return res.status(400).json({ success: false, error: 'start and end are required' });
    }
    const records = await attendanceService.getDateRange(undefined, start, end);
    const headers = ['Employee', 'Email', 'Date', 'Check In', 'Check Out', 'Status', 'Overtime (hrs)', 'Notes'];
    const rows = records.map((a) => [
      a.employee.name,
      a.employee.email,
      new Date(a.date).toISOString().split('T')[0],
      a.checkIn ? new Date(a.checkIn).toISOString() : '',
      a.checkOut ? new Date(a.checkOut).toISOString() : '',
      a.status,
      a.overtimeHrs,
      a.notes ?? '',
    ]);
    csvResponse(res, `attendance-${start}-to-${end}.csv`, toCsv(headers, rows));
  } catch (err) {
    next(err);
  }
}
