import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import * as leaveService from '../services/leave.service';
import { logAudit } from '../services/audit.service';
import { notifyRole, createNotification } from '../services/notification.service';
import { toCsv, csvResponse } from '../lib/csv';
import { excelResponse } from '../lib/excel';
import { z } from 'zod';

export async function getAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status } = req.query as { status?: string };
    const { page, pageSize } = req.query as { page?: string; pageSize?: string };

    if (req.user?.role === 'Employee') {
      const employeeId = req.user.employeeId;
      if (!employeeId) {
        if (page || pageSize) {
          const p = Math.max(parseInt(page || '1', 10) || 1, 1);
          const ps = Math.min(Math.max(parseInt(pageSize || '20', 10) || 20, 1), 100);
          return res.json({ success: true, data: { data: [], pagination: { page: p, pageSize: ps, total: 0, totalPages: 0 } } });
        }
        return res.json({ success: true, data: [] });
      }
      if (page || pageSize) {
        const p = Math.max(parseInt(page || '1', 10) || 1, 1);
        const ps = Math.min(Math.max(parseInt(pageSize || '20', 10) || 20, 1), 100);
        const result = await leaveService.getAllPaginated({ page: p, pageSize: ps, status, employeeIds: [employeeId] });
        return res.json({ success: true, data: result });
      }
      const leaves = await leaveService.getAll(status, undefined, [employeeId]);
      return res.json({ success: true, data: leaves });
    }

    if (page || pageSize) {
      const p = Math.max(parseInt(page || '1', 10) || 1, 1);
      const ps = Math.min(Math.max(parseInt(pageSize || '20', 10) || 20, 1), 100);
      const { employeeId } = req.query as { employeeId?: string };
      const result = await leaveService.getAllPaginated({ page: p, pageSize: ps, status, employeeId });
      return res.json({ success: true, data: result });
    }
    const { employeeId } = req.query as { status?: string; employeeId?: string };
    const leaves = await leaveService.getAll(status, employeeId);
    res.json({ success: true, data: leaves });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const leave = await leaveService.getById(String(req.params.id));
    if (req.user?.role === 'Employee') {
      if (leave.employeeId !== req.user.employeeId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }
    res.json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = leaveService.createLeaveSchema.parse(req.body);
    if (req.user?.role === 'Employee') {
      if (!req.user.employeeId) return res.status(400).json({ success: false, error: 'No employee profile linked to your account' });
      data.employeeId = req.user.employeeId;
    } else if (!data.employeeId) {
      return res.status(400).json({ success: false, error: 'employeeId is required' });
    }
    const leave = await leaveService.create(data as z.infer<typeof leaveService.createLeaveSchema> & { employeeId: string });
    await notifyRole(
      'HR',
      `New ${leave.type} leave request from ${leave.employee.name}`,
      'leave_request',
      '/leaves',
    );
    await notifyRole(
      'Admin',
      `New ${leave.type} leave request from ${leave.employee.name}`,
      'leave_request',
      '/leaves',
    );
    if (leave.employee.reportsToId) {
      const manager = await prisma.employee.findUnique({
        where: { id: leave.employee.reportsToId },
        include: { user: { select: { id: true } } },
      });
      if (manager?.user) {
        await createNotification(
          manager.user.id,
          `${leave.employee.name} submitted a ${leave.type} leave request`,
          'leave_request',
          '/leaves',
        );
      }
    }
    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = leaveService.updateLeaveSchema.parse(req.body);
    const leave = await leaveService.update(String(req.params.id), data, req.user!.employeeId!);
    res.json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { cancelReason } = leaveService.cancelLeaveSchema.parse(req.body);
    const leave = await leaveService.cancel(String(req.params.id), cancelReason, req.user!.employeeId!);
    res.json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
}

export async function review(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status, comment } = leaveService.reviewLeaveSchema.parse(req.body);
    const leave = await leaveService.review(
      String(req.params.id),
      status,
      req.user!.userId,
      comment,
      req.user!.role,
      req.user!.employeeId ?? undefined,
    );
    await logAudit(req, {
      action: `LEAVE_${status.toUpperCase()}`,
      entity: 'LeaveRequest',
      entityId: leave.id,
      details: `${leave.employee.name} ${leave.type} (${status})`,
    });
    if (leave.employee.user) {
      await createNotification(
        leave.employee.user.id,
        `Your ${leave.type} leave request was ${status.toLowerCase()}`,
        'leave_reviewed',
        '/leaves',
      );
    }
    res.json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
}

export async function getBalances(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = req.user?.role === 'Employee' ? req.user.employeeId : (req.query.employeeId as string | undefined);
    if (!employeeId) return res.status(400).json({ success: false, error: 'employeeId is required' });
    const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    const data = await leaveService.getBalances(employeeId, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function myLeaves(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.employeeId) return res.status(400).json({ success: false, error: 'No employee profile' });
    const leaves = await leaveService.getAll(undefined, undefined, [req.user.employeeId]);
    res.json({ success: true, data: leaves });
  } catch (err) {
    next(err);
  }
}

export async function exportExcel(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const leaves = await leaveService.getAllForExport();
    const rows = leaves.map((l) => ({
      Employee: l.employee.name,
      Email: l.employee.email,
      Type: l.type,
      'Start Date': new Date(l.startDate).toISOString().split('T')[0],
      'End Date': new Date(l.endDate).toISOString().split('T')[0],
      Days: l.totalDays,
      Status: l.isCancelled ? 'Cancelled' : l.status,
      Reason: l.reason,
      'Review Comment': l.reviewComment ?? '',
      'Reviewed By': l.reviewer?.email ?? '',
    }));
    await excelResponse(
      res,
      `leaves-${new Date().toISOString().split('T')[0]}.xlsx`,
      'Leaves',
      [
        { header: 'Employee', key: 'Employee', width: 24 },
        { header: 'Email', key: 'Email', width: 30 },
        { header: 'Type', key: 'Type', width: 16 },
        { header: 'Start Date', key: 'Start Date', width: 14 },
        { header: 'End Date', key: 'End Date', width: 14 },
        { header: 'Days', key: 'Days', width: 10 },
        { header: 'Status', key: 'Status', width: 12 },
        { header: 'Reason', key: 'Reason', width: 32 },
        { header: 'Review Comment', key: 'Review Comment', width: 28 },
        { header: 'Reviewed By', key: 'Reviewed By', width: 26 },
      ],
      rows,
    );
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const leaves = await leaveService.getAllForExport();
    const headers = ['Employee', 'Email', 'Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason', 'Review Comment', 'Reviewed By'];
    const rows = leaves.map((l) => [
      l.employee.name,
      l.employee.email,
      l.type,
      new Date(l.startDate).toISOString().split('T')[0],
      new Date(l.endDate).toISOString().split('T')[0],
      l.totalDays,
      l.isCancelled ? 'Cancelled' : l.status,
      l.reason,
      l.reviewComment ?? '',
      l.reviewer?.email ?? '',
    ]);
    csvResponse(res, `leaves-${new Date().toISOString().split('T')[0]}.csv`, toCsv(headers, rows));
  } catch (err) {
    next(err);
  }
}
