import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { getAuditLogs } from '../services/audit.service';

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10) || 1;
    const pageSize = Math.min(parseInt(String(req.query.pageSize ?? '20'), 10) || 20, 100);
    const { action, userEmail, entity } = req.query as { action?: string; userEmail?: string; entity?: string };
    const result = await getAuditLogs({ page, pageSize, action, userEmail, entity });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
