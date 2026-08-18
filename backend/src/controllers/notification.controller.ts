import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as notificationService from '../services/notification.service';

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
    const notifications = await notificationService.listForUser(req.user!.userId, limit);
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
}

export async function countUnread(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const count = await notificationService.unreadCount(req.user!.userId);
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const notification = await notificationService.markRead(req.user!.userId, String(req.params.id));
    if (!notification) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await notificationService.markAllRead(req.user!.userId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
