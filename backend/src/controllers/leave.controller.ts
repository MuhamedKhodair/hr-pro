import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as leaveService from '../services/leave.service';
import { z } from 'zod';

export async function getAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status } = req.query as { status?: string };
    if (req.user?.role === 'Employee') {
      const leaves = await leaveService.getAll(status, req.user.employeeId!);
      return res.json({ success: true, data: leaves });
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
    if (req.user?.role === 'Employee' && leave.employeeId !== req.user.employeeId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
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
    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
}

export async function review(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status } = leaveService.reviewLeaveSchema.parse(req.body);
    const leave = await leaveService.review(String(req.params.id), status, req.user!.userId);
    res.json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
}

export async function myLeaves(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.employeeId) return res.status(400).json({ success: false, error: 'No employee profile' });
    const leaves = await leaveService.getAll(undefined, req.user.employeeId);
    res.json({ success: true, data: leaves });
  } catch (err) {
    next(err);
  }
}
