import prisma from '../lib/prisma';
import { Role } from '@prisma/client';
import { pushToUser } from '../lib/ws';

function pushNotification(userId: string, notification: { id: string; message: string; type: string; link: string | null; createdAt: Date }) {
  pushToUser(userId, {
    event: 'notification',
    id: notification.id,
    message: notification.message,
    type: notification.type,
    link: notification.link,
    createdAt: notification.createdAt.toISOString(),
  });
}

export async function createNotification(userId: string, message: string, type: string, link?: string) {
  try {
    const notification = await prisma.notification.create({ data: { userId, message, type, link } });
    pushNotification(userId, notification);
    return notification;
  } catch (err) {
    // Notifications must never break the main flow.
    console.error('Notification create failed:', err);
    return null;
  }
}

export async function notifyRole(role: Role, message: string, type: string, link?: string) {
  const users = await prisma.user.findMany({ where: { role }, select: { id: true } });
  try {
    const created = await prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, message, type, link })),
    });
    for (const user of users) {
      pushToUser(user.id, { event: 'notification', message, type, link, count: 1 });
    }
    return created.count;
  } catch (err) {
    console.error('Notification createMany failed:', err);
  }
  return users.length;
}

export async function listForUser(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markRead(userId: string, id: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) return null;
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
