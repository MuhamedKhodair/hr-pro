import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as searchService from '../services/search.service';

export async function search(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q || '');
    const results = await searchService.search(q, req.user!);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}
