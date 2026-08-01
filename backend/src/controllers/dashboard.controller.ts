import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as dashboardService from '../services/dashboard.service';

export async function getStats(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await dashboardService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}
