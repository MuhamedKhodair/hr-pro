import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as attendanceService from '../services/attendance.service';

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

export async function getMonthly(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = String(req.params.employeeId);
    const year = String(req.params.year);
    const month = String(req.params.month);
    const records = await attendanceService.getMonthly(employeeId, parseInt(year), parseInt(month));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
}
