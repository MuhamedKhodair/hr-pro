import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as onboardingService from '../services/onboarding.service';
import { logAudit } from '../services/audit.service';
import { AppError } from '../lib/errors';

// ---------- Template tasks ----------

export async function listTasks(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tasks = await onboardingService.listAllTasks();
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
}

export async function createTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = onboardingService.taskSchema.parse(req.body);
    const task = await onboardingService.createTask(data);
    await logAudit(req, { action: 'ONBOARDING_TASK_CREATED', entity: 'OnboardingTask', entityId: task.id, details: task.name });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = onboardingService.taskSchema.parse(req.body);
    const task = await onboardingService.updateTask(String(req.params.id), data);
    await logAudit(req, { action: 'ONBOARDING_TASK_UPDATED', entity: 'OnboardingTask', entityId: task.id, details: task.name });
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const task = await onboardingService.deleteTask(id);
    await logAudit(req, { action: 'ONBOARDING_TASK_DELETED', entity: 'OnboardingTask', entityId: id, details: task.name });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

// ---------- Assignments ----------

export async function listAssignments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = req.query.employeeId as string | undefined;
    if (req.user!.role === 'Employee' && employeeId && employeeId !== req.user!.employeeId) {
      throw new AppError(403, 'Access denied');
    }
    const data = await onboardingService.listAssignments({
      employeeId: req.user!.role === 'Employee' ? req.user!.employeeId! : employeeId,
      status: req.query.status as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function generateForEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await onboardingService.generateAssignments(String(req.params.employeeId));
    await logAudit(req, { action: 'ONBOARDING_GENERATED', entity: 'Employee', entityId: String(req.params.employeeId) });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function generateForAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await onboardingService.generateForAllActiveEmployees();
    await logAudit(req, { action: 'ONBOARDING_GENERATED_ALL', details: JSON.stringify(result) });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function setAssignmentStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = onboardingService.statusSchema.parse(req.body);
    if (req.user!.role === 'Employee') {
      const permission = await onboardingService.canManageAssignment(String(req.params.id), req.user!.employeeId);
      if (!permission) throw new AppError(403, 'Access denied');
    }
    const assignment = await onboardingService.setAssignmentStatus(String(req.params.id), data, req.user!.userId);
    await logAudit(req, { action: 'ONBOARDING_STATUS_CHANGED', entity: 'OnboardingAssignment', entityId: assignment.id, details: data.status });
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

export async function progressOverview(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await onboardingService.progressOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}