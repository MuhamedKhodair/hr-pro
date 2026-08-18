import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as departmentService from '../services/department.service';

export async function getAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, pageSize } = req.query as { page?: string; pageSize?: string };
    if (page || pageSize) {
      const p = Math.max(parseInt(page || '1', 10) || 1, 1);
      const ps = Math.min(Math.max(parseInt(pageSize || '20', 10) || 20, 1), 100);
      const result = await departmentService.getAllPaginated({ page: p, pageSize: ps });
      return res.json({ success: true, data: result });
    }
    const departments = await departmentService.getAll();
    res.json({ success: true, data: departments });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const department = await departmentService.getById(String(req.params.id));
    res.json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = departmentService.createDepartmentSchema.parse(req.body);
    const department = await departmentService.create(data);
    res.status(201).json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = departmentService.updateDepartmentSchema.parse(req.body);
    const department = await departmentService.update(String(req.params.id), data);
    res.json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await departmentService.remove(String(req.params.id));
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
