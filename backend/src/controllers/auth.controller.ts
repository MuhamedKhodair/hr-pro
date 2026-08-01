import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';

export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = authService.loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = authService.registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: 'Refresh token required' });
    const tokens = await authService.refresh(refreshToken);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.userId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}
