import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as shiftService from '../services/shift.service';
import { logAudit } from '../services/audit.service';

export async function getAll(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const shifts = await shiftService.getAllShifts();
    res.json({ success: true, data: shifts });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = shiftService.shiftSchema.parse(req.body);
    const shift = await shiftService.createShift(data);
    await logAudit(req, { action: 'SHIFT_CREATED', entity: 'Shift', entityId: shift.id, details: shift.name });
    res.status(201).json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = shiftService.shiftSchema.parse(req.body);
    const shift = await shiftService.updateShift(String(req.params.id), data);
    await logAudit(req, { action: 'SHIFT_UPDATED', entity: 'Shift', entityId: shift.id, details: shift.name });
    res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    await shiftService.deleteShift(id);
    await logAudit(req, { action: 'SHIFT_DELETED', entity: 'Shift', entityId: id });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function getShiftEmployees(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employees = await shiftService.getShiftEmployees(String(req.params.id));
    res.json({ success: true, data: employees });
  } catch (err) {
    next(err);
  }
}

export async function assign(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = shiftService.assignShiftSchema.parse(req.body);
    const result = await shiftService.assignEmployees(String(req.params.id), data.employeeIds);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function unassign(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await shiftService.unassignEmployee(String(req.params.id), String(req.params.employeeId));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listUnassigned(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employees = await shiftService.getUnassignedEmployees();
    res.json({ success: true, data: employees });
  } catch (err) {
    next(err);
  }
}

export async function myShift(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return res.status(400).json({ success: false, error: 'No employee profile linked to your account' });
    const shift = await shiftService.getMyShift(employeeId);
    res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
}
