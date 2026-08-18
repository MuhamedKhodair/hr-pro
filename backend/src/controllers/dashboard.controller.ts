import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as dashboardService from '../services/dashboard.service';
import { getScopeEmployeeIds } from '../services/scope.service';

async function scopeOf(req: AuthRequest): Promise<string[] | undefined> {
  if (req.user?.role !== 'Employee') return undefined;
  return getScopeEmployeeIds(req.user.employeeId);
}

export async function getStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await dashboardService.getStats(await scopeOf(req));
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

export async function getHeadcount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await dashboardService.getDepartmentHeadcount(await scopeOf(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUpcoming(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const days = Math.min(parseInt(String(req.query.days ?? '30'), 10) || 30, 90);
    const scope = await scopeOf(req);
    const [birthdays, anniversaries] = await Promise.all([
      dashboardService.getUpcomingBirthdays(days, scope),
      dashboardService.getUpcomingAnniversaries(days, scope),
    ]);
    res.json({ success: true, data: { birthdays, anniversaries } });
  } catch (err) {
    next(err);
  }
}

export async function getActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await dashboardService.getRecentActivity(undefined, await scopeOf(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}