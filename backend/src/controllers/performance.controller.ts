import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as performanceService from '../services/performance.service';
import { logAudit } from '../services/audit.service';
import { AppError } from '../lib/errors';

const userId = (req: AuthRequest) => req.user?.userId;

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { periodName, status, employeeId } = req.query as Record<string, string | undefined>;
    const reviews = await performanceService.listReviews({ periodName, status, employeeId });
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
}

export async function stats(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await performanceService.getStats() });
  } catch (err) {
    next(err);
  }
}

export async function periods(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await performanceService.getPeriods() });
  } catch (err) {
    next(err);
  }
}

export async function criteria(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await performanceService.getDefaultCriteria() });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = performanceService.reviewSchema.parse(req.body);
    const review = await performanceService.createReview(data, userId(req));
    await logAudit(req, {
      action: 'REVIEW_CREATED',
      entity: 'PerformanceReview',
      entityId: review.id,
      details: `${review.employee?.name ?? ''} (${review.periodName}) overall ${review.overallScore}`,
    });
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const data = performanceService.reviewSchema.parse(req.body);
    const review = await performanceService.updateReview(id, data, userId(req));
    if (!review) throw new AppError(404, 'Review not found');
    await logAudit(req, {
      action: 'REVIEW_UPDATED',
      entity: 'PerformanceReview',
      entityId: review.id,
      details: `${review.employee?.name ?? ''} (${review.periodName})`,
    });
    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
}

export async function complete(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const data = performanceService.completeSchema.parse(req.body);
    const review = await performanceService.completeReview(id, data.reviewComment ?? '', userId(req));
    if (!review) throw new AppError(404, 'Review not found');
    await logAudit(req, {
      action: 'REVIEW_COMPLETED',
      entity: 'PerformanceReview',
      entityId: review.id,
      details: `${review.employee?.name ?? ''} (${review.periodName}) overall ${review.overallScore}`,
    });
    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const deleted = await performanceService.removeReview(id);
    if (!deleted) throw new AppError(404, 'Review not found');
    await logAudit(req, {
      action: 'REVIEW_DELETED',
      entity: 'PerformanceReview',
      entityId: id,
    });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
