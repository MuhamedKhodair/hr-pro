import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../lib/errors';
import { ApiResponse } from '../types';

function isCorsError(err: Error): boolean {
  return err.message?.startsWith('Origin ') && err.message.includes('not allowed by CORS');
}

export const errorHandler = (err: Error, _req: Request, res: Response<ApiResponse>, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') });
  }
  if (isCorsError(err)) {
    return res.status(403).json({ success: false, error: err.message });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : `Upload failed: ${err.code}`;
    return res.status(400).json({ success: false, error: message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'A record with the same unique value already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, error: 'Internal server error' });
};
