import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as usersService from '../services/users.service';
import { logAudit } from '../services/audit.service';

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const users = await usersService.listUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = usersService.createUserSchema.parse(req.body);
    const user = await usersService.createUser(data);
    await logAudit(req, {
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      details: `${user.email} (${user.role})`,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { password } = usersService.resetPasswordSchema.parse(req.body);
    await usersService.resetPassword(String(req.params.id), password);
    await logAudit(req, {
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: String(req.params.id),
    });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await usersService.removeUser(String(req.params.id), req.user!.userId);
    await logAudit(req, {
      action: 'USER_DELETED',
      entity: 'User',
      entityId: String(req.params.id),
    });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
