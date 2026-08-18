import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
}

export async function logAudit(req: AuthRequest, entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        userEmail: req.user?.email,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details,
        ip: req.ip,
      },
    });
  } catch (err) {
    // Audit logging must never break the main flow.
    console.error('Audit log write failed:', err);
  }
}

export async function getAuditLogs(options: {
  page: number;
  pageSize: number;
  action?: string;
  userEmail?: string;
  entity?: string;
}) {
  const { page, pageSize, action, userEmail, entity } = options;
  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (userEmail) where.userEmail = { contains: userEmail };
  if (entity) where.entity = entity;

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
