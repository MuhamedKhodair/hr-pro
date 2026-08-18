import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AuthRequest, JwtPayload } from '../types';
import { AppError } from '../lib/errors';
import { ACCESS_TOKEN_COOKIE } from '../lib/cookies';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const PASS_CHANGE_WHITELIST = [
  '/api/auth/change-password',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/sessions',
];

export const authenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
    let token: string | undefined;
    if (header?.startsWith('Bearer ')) {
      token = header.slice(7);
    } else if (cookieToken) {
      token = cookieToken;
    }
    if (!token) {
      throw new AppError(401, 'No token provided');
    }
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;

    const url = req.originalUrl.split('?')[0];
    const allowed = PASS_CHANGE_WHITELIST.some((p) => url === p || url.startsWith(p + '/'));
    if (allowed) return next();

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { mustChangePassword: true },
    });
    if (!user) return next(new AppError(401, 'User no longer exists'));
    if (user.mustChangePassword) {
      return next(new AppError(403, 'You must change your password before continuing', 'FORCED_PASSWORD_CHANGE'));
    }
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
