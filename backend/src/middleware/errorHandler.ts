import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { ApiResponse } from '../types';

export const errorHandler = (err: Error, _req: Request, res: Response<ApiResponse>, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, error: 'Internal server error' });
};
