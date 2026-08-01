import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as employeeService from '../services/employee.service';

export async function getAll(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employees = await employeeService.getAll();
    res.json({ success: true, data: employees });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employee = await employeeService.getById(String(req.params.id));
    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = employeeService.createEmployeeSchema.parse(req.body);
    const employee = await employeeService.create(data);
    res.status(201).json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = employeeService.updateEmployeeSchema.parse(req.body);
    const employee = await employeeService.update(String(req.params.id), data);
    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await employeeService.remove(String(req.params.id));
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
