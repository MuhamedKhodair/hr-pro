import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';
import { queueEmail } from '../lib/email';
import { candidateStatusEmail, interviewScheduledEmail } from '../lib/emailTemplates';

export const jobSchema = z.object({
  title: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).default('FULL_TIME'),
  remote: z.boolean().default(false),
  location: z.string().optional().nullable(),
  slots: z.number().int().min(1).default(1),
  description: z.string().default(''),
  requirements: z.string().default(''),
  salaryMin: z.number().min(0).optional().nullable(),
  salaryMax: z.number().min(0).optional().nullable(),
});

export const candidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  source: z.string().default(''),
  jobId: z.string().optional().nullable(),
  status: z.enum(['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN']).optional(),
  resumeUrl: z.string().url().optional().nullable(),
  notes: z.string().default(''),
});

export const candidateStatusSchema = z.object({
  status: z.enum(['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN']),
});

export const interviewSchema = z.object({
  candidateId: z.string().min(1),
  jobId: z.string().optional().nullable(),
  interviewerId: z.string().optional().nullable(),
  type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL']).default('VIDEO'),
  scheduledAt: z.coerce.date(),
  durationMin: z.number().int().min(15).max(480).default(60),
  meetingLink: z.string().url().optional().nullable(),
  location: z.string().optional().nullable(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().min(1),
});

const jobInclude = {
  department: true,
  _count: { select: { candidates: true } },
} as const;

// ---------- Jobs ----------

export async function listJobs(query: { status?: string; departmentId?: string; search?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search } },
      { location: { contains: query.search } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      include: jobInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.jobPosting.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

export async function getJob(id: string) {
  const job = await prisma.jobPosting.findUnique({
    where: { id },
    include: { ...jobInclude, candidates: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!job) throw new AppError(404, 'Job posting not found');
  return job;
}

export async function createJob(data: z.infer<typeof jobSchema>, userId: string) {
  return prisma.jobPosting.create({ data: { ...data, createdBy: userId } });
}

export async function updateJob(id: string, data: z.infer<typeof jobSchema>) {
  const job = await prisma.jobPosting.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'Job posting not found');
  return prisma.jobPosting.update({ where: { id }, data });
}

export async function setJobStatus(id: string, status: 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED') {
  const job = await prisma.jobPosting.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'Job posting not found');
  return prisma.jobPosting.update({
    where: { id },
    data: {
      status,
      publishedAt: status === 'OPEN' && !job.publishedAt ? new Date() : job.publishedAt,
      closedAt: status === 'CLOSED' ? new Date() : null,
    },
  });
}

export async function deleteJob(id: string) {
  const job = await prisma.jobPosting.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'Job posting not found');
  const candidates = await prisma.candidate.count({ where: { jobId: id } });
  if (candidates > 0) {
    throw new AppError(400, `Cannot delete job: ${candidates} candidate(s) are linked to it`);
  }
  return prisma.jobPosting.delete({ where: { id } });
}

// ---------- Candidates ----------

const candidateInclude = {
  job: true,
  _count: { select: { interviews: true } },
} as const;

export async function listCandidates(query: { status?: string; jobId?: string; search?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.jobId) where.jobId = query.jobId;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search } },
      { email: { contains: query.search } },
      { phone: { contains: query.search } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      include: candidateInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.candidate.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

export async function getCandidate(id: string) {  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      job: true,
      interviews: { orderBy: { scheduledAt: 'desc' }, include: { interviewer: true, job: true } },
    },
  });
  if (!candidate) throw new AppError(404, 'Candidate not found');
  return candidate;
}

export async function createCandidate(data: z.infer<typeof candidateSchema>) {
  return prisma.candidate.create({ data });
}

export async function updateCandidate(id: string, data: z.infer<typeof candidateSchema>) {
  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) throw new AppError(404, 'Candidate not found');
  return prisma.candidate.update({ where: { id }, data });
}

export async function setCandidateStatus(id: string, status: z.infer<typeof candidateStatusSchema>['status']) {
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { job: true },
  });
  if (!candidate) throw new AppError(404, 'Candidate not found');
  const updated = await prisma.candidate.update({ where: { id }, data: { status } });
  if (['OFFER', 'HIRED', 'REJECTED'].includes(status) && candidate.email) {
    queueEmail({
      to: candidate.email,
      ...candidateStatusEmail(candidate.name, candidate.job?.title ?? 'position', status),
    }).catch(() => {});
  }
  return updated;
}

export async function deleteCandidate(id: string) {
  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) throw new AppError(404, 'Candidate not found');
  return prisma.candidate.delete({ where: { id } });
}

// ---------- Interviews ----------

const interviewInclude = {
  candidate: true,
  job: true,
  interviewer: true,
} as const;

export async function listInterviews(query: {
  status?: string;
  candidateId?: string;
  interviewerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.candidateId) where.candidateId = query.candidateId;
  if (query.interviewerId) where.interviewerId = query.interviewerId;
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.gte = new Date(query.from);
    if (query.to) range.lte = new Date(query.to);
    where.scheduledAt = range;
  }
  const [data, total] = await Promise.all([
    prisma.interview.findMany({
      where,
      include: interviewInclude,
      orderBy: { scheduledAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.interview.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

export async function createInterview(data: z.infer<typeof interviewSchema>, createdBy?: string) {
  const candidate = await prisma.candidate.findUnique({ where: { id: data.candidateId } });
  if (!candidate) throw new AppError(404, 'Candidate not found');
  const interview = await prisma.interview.create({ data: { ...data, createdBy } });
  await notifyInterviewer(data.interviewerId, `Interview scheduled for ${candidate.name}`, `/recruitment`);
  if (candidate.email && data.jobId) {
    const job = await prisma.jobPosting.findUnique({ where: { id: data.jobId } });
    queueEmail({
      to: candidate.email,
      ...interviewScheduledEmail(candidate.name, job?.title ?? 'position', data.scheduledAt, data.type),
    }).catch(() => {});
  }
  return interview;
}

export async function updateInterview(id: string, data: z.infer<typeof interviewSchema>) {
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) throw new AppError(404, 'Interview not found');
  return prisma.interview.update({ where: { id }, data });
}

export async function cancelInterview(id: string) {
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) throw new AppError(404, 'Interview not found');
  if (interview.status === 'COMPLETED') throw new AppError(400, 'Completed interviews cannot be cancelled');
  return prisma.interview.update({ where: { id }, data: { status: 'CANCELLED' } });
}

export async function getInterviewOrThrow(id: string) {
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) throw new AppError(404, 'Interview not found');
  return interview;
}

export async function submitFeedback(id: string, data: z.infer<typeof feedbackSchema>) {
  const interview = await getInterviewOrThrow(id);
  if (interview.status === 'CANCELLED') throw new AppError(400, 'Cancelled interviews cannot receive feedback');
  return prisma.interview.update({
    where: { id },
    data: { status: 'COMPLETED', rating: data.rating, feedback: data.feedback },
  });
}

export async function recruitmentStats() {
  const [openJobs, activeCandidates, byStatus, upcomingInterviews, hiresThisMonth] = await Promise.all([
    prisma.jobPosting.count({ where: { status: 'OPEN' } }),
    prisma.candidate.count({ where: { status: { notIn: ['REJECTED', 'WITHDRAWN'] } } }),
    prisma.candidate.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.interview.count({
      where: { status: 'SCHEDULED', scheduledAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) } },
    }),
    prisma.candidate.count({
      where: {
        status: 'HIRED',
        updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);
  return { openJobs, activeCandidates, hiresThisMonth, upcomingInterviews, byStatus };
}

async function notifyInterviewer(interviewerId: string | null | undefined, message: string, link: string) {
  if (!interviewerId) return;
  const user = await prisma.user.findUnique({ where: { employeeId: interviewerId } });
  if (!user) return;
  const { createNotification } = await import('../services/notification.service');
  await createNotification(user.id, message, 'recruitment', link);
}
