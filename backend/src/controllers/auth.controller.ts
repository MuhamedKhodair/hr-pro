import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';
import { setAuthCookies, clearAuthCookies, REFRESH_TOKEN_COOKIE } from '../lib/cookies';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function metaFrom(req: AuthRequest) {
  return { userAgent: req.headers['user-agent'] as string | undefined, ip: req.ip };
}

export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = authService.loginSchema.parse(req.body);
    const result = await authService.login(email, password, metaFrom(req));
    if (result.accessToken && result.refreshToken) {
      setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    }
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

export async function selfRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const data = authService.selfRegisterSchema.parse(req.body);
    const result = await authService.selfRegister(data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = authService.changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.userId, data.currentPassword, data.newPassword);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const refreshToken = (req.body?.refreshToken as string | undefined) ||
      (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined);
    if (!refreshToken) return res.status(400).json({ success: false, error: 'Refresh token required' });
    const result = await authService.refresh(refreshToken, metaFrom(req));
    setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const refreshToken = (req.body?.refreshToken as string | undefined) ||
      (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined);
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearAuthCookies(res);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function sessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sessions = await authService.listSessions(req.user!.userId);
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

export async function revokeSession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await authService.revokeSession(req.user!.userId, String(req.params.id));
    res.json({ success: true, data: null });
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

export async function twoFactorSetup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await authService.setupTwoFactor(req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function twoFactorEnable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code } = authService.twoFactorCodeSchema.parse(req.body);
    const data = await authService.enableTwoFactor(req.user!.userId, code);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function twoFactorDisable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code } = authService.twoFactorCodeSchema.parse(req.body);
    await authService.disableTwoFactor(req.user!.userId, code);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function twoFactorVerifyLogin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { twoFactorToken, code } = authService.twoFactorLoginSchema.parse(req.body);
    const result = await authService.verifyTwoFactorLogin(twoFactorToken, code, metaFrom(req));
    if (result.accessToken && result.refreshToken) {
      setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function wsToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = jwt.sign({ userId: req.user!.userId, purpose: 'ws' }, JWT_SECRET, { expiresIn: '1m' });
    res.json({ success: true, data: { token } });
  } catch (err) {
    next(err);
  }
}
