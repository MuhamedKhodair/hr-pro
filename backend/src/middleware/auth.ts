import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JwtPayload } from '../types';
import { AppError } from '../lib/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, 'No token provided');
    }
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err instanceof AppError) return next(err);
    if (err?.name === 'TokenExpiredError') return next(new AppError(401, 'Token expired'));
    return next(new AppError(401, 'Invalid token'));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'Insufficient permissions');
    }
    next();
  };
};
