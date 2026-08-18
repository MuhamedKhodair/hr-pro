import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as holidayService from '../services/holiday.service';
import { logAudit } from '../services/audit.service';

export async function list(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const holidays = await holidayService.listHolidays();
    res.json({ success: true, data: holidays });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = holidayService.holidaySchema.parse(req.body);
    const holiday = await holidayService.createHoliday(data);
    await logAudit(req, {
      action: 'HOLIDAY_CREATE',
      entity: 'Holiday',
      entityId: holiday.id,
      details: `${holiday.name} (${new Date(holiday.date).toISOString().split('T')[0]})`,
    });
    res.status(201).json({ success: true, data: holiday });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const holiday = await holidayService.removeHoliday(String(req.params.id));
    await logAudit(req, {
      action: 'HOLIDAY_DELETE',
      entity: 'Holiday',
      entityId: holiday.id,
      details: `${holiday.name} (${new Date(holiday.date).toISOString().split('T')[0]})`,
    });
    res.json({ success: true, data: holiday });
  } catch (err) {
    next(err);
  }
}
