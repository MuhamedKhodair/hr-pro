import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as recruitmentService from '../services/recruitment.service';
import { logAudit } from '../services/audit.service';
import { AppError } from '../lib/errors';

// ---------- Jobs ----------

export async function listJobs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await recruitmentService.listJobs({
      status: req.query.status as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getJob(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const job = await recruitmentService.getJob(String(req.params.id));
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function createJob(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = recruitmentService.jobSchema.parse(req.body);
    const job = await recruitmentService.createJob(data, req.user!.userId);
    await logAudit(req, { action: 'JOB_CREATED', entity: 'JobPosting', entityId: job.id, details: job.title });
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function updateJob(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = recruitmentService.jobSchema.parse(req.body);
    const job = await recruitmentService.updateJob(String(req.params.id), data);
    await logAudit(req, { action: 'JOB_UPDATED', entity: 'JobPosting', entityId: job.id, details: job.title });
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function setJobStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status } = req.body as { status: string };
    if (!['DRAFT', 'OPEN', 'PAUSED', 'CLOSED'].includes(status)) throw new AppError(400, 'Invalid job status');
    const job = await recruitmentService.setJobStatus(String(req.params.id), status as 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED');
    await logAudit(req, { action: 'JOB_STATUS_CHANGED', entity: 'JobPosting', entityId: job.id, details: `${job.title} -> ${status}` });
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function deleteJob(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    await recruitmentService.deleteJob(id);
    await logAudit(req, { action: 'JOB_DELETED', entity: 'JobPosting', entityId: id });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

// ---------- Candidates ----------

export async function listCandidates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await recruitmentService.listCandidates({
      status: req.query.status as string | undefined,
      jobId: req.query.jobId as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const candidate = await recruitmentService.getCandidate(String(req.params.id));
    res.json({ success: true, data: candidate });
  } catch (err) {
    next(err);
  }
}

export async function createCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = recruitmentService.candidateSchema.parse(req.body);
    const candidate = await recruitmentService.createCandidate(data);
    await logAudit(req, { action: 'CANDIDATE_CREATED', entity: 'Candidate', entityId: candidate.id, details: candidate.name });
    res.status(201).json({ success: true, data: candidate });
  } catch (err) {
    next(err);
  }
}

export async function updateCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = recruitmentService.candidateSchema.parse(req.body);
    const candidate = await recruitmentService.updateCandidate(String(req.params.id), data);
    await logAudit(req, { action: 'CANDIDATE_UPDATED', entity: 'Candidate', entityId: candidate.id, details: candidate.name });
    res.json({ success: true, data: candidate });
  } catch (err) {
    next(err);
  }
}

export async function setCandidateStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = recruitmentService.candidateStatusSchema.parse(req.body);
    const candidate = await recruitmentService.setCandidateStatus(String(req.params.id), data.status);
    await logAudit(req, { action: 'CANDIDATE_STATUS_CHANGED', entity: 'Candidate', entityId: candidate.id, details: `${candidate.name} -> ${data.status}` });
    res.json({ success: true, data: candidate });
  } catch (err) {
    next(err);
  }
}

export async function deleteCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    await recruitmentService.deleteCandidate(id);
    await logAudit(req, { action: 'CANDIDATE_DELETED', entity: 'Candidate', entityId: id });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

// ---------- Interviews ----------

export async function listInterviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const employeeId = req.user!.employeeId;
    const data = await recruitmentService.listInterviews({
      status: req.query.status as string | undefined,
      candidateId: req.query.candidateId as string | undefined,
      interviewerId:
        req.user!.role === 'Employee'
          ? employeeId ?? 'none'
          : (req.query.interviewerId as string | undefined),
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = recruitmentService.interviewSchema.parse(req.body);
    const interview = await recruitmentService.createInterview(data, req.user!.userId);
    await logAudit(req, { action: 'INTERVIEW_CREATED', entity: 'Interview', entityId: interview.id });
    res.status(201).json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

export async function updateInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = recruitmentService.interviewSchema.parse(req.body);
    const interview = await recruitmentService.updateInterview(String(req.params.id), data);
    await logAudit(req, { action: 'INTERVIEW_UPDATED', entity: 'Interview', entityId: interview.id });
    res.json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

export async function cancelInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const interview = await recruitmentService.cancelInterview(id);
    await logAudit(req, { action: 'INTERVIEW_CANCELLED', entity: 'Interview', entityId: id });
    res.json({ success: true, data: interview });
  } catch (err) {
    next(err);
  }
}

export async function submitFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = recruitmentService.feedbackSchema.parse(req.body);
    const interview = await recruitmentService.getInterviewOrThrow(String(req.params.id));
    if (req.user!.role === 'Employee' && interview.interviewerId !== req.user!.employeeId) {
      throw new AppError(403, 'Only the assigned interviewer can submit feedback');
    }
    const updated = await recruitmentService.submitFeedback(String(req.params.id), data);
    await logAudit(req, { action: 'INTERVIEW_FEEDBACK', entity: 'Interview', entityId: updated.id });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function getStats(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await recruitmentService.recruitmentStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}
