'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useRequireRole } from '@/hooks/useRequireRole';

import { motion } from 'framer-motion';
import {
  Briefcase, Pencil, Trash2, Play, Pause, XCircle, CalendarPlus,
  CheckCircle, Building2, MapPin, Clock, Link2, Star, MessageSquare, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut, useApiPatch, useApiDelete } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { TableSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/tables/data-table';
import { StatsCard } from '@/components/dashboard/stats-card';
import { formatDateTime, cn } from '@/lib/utils';
import { getUser } from '@/lib/auth';

const JOB_TYPE_OPTIONS: [string, string][] = [
  ['FULL_TIME', 'Full Time'],
  ['PART_TIME', 'Part Time'],
  ['CONTRACT', 'Contract'],
  ['INTERNSHIP', 'Internship'],
];

interface ListResponse<T> {
  data: T[] | null;
  total: number;
}

interface Job {
  id: string;
  title: string;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';
  remote: boolean;
  location: string | null;
  slots: number;
  description: string;
  requirements: string;
  salaryMin: number | null;
  salaryMax: number | null;
  status: 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED';
  publishedAt: string | null;
  closedAt: string | null;
  _count: { candidates: number };
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  jobId: string | null;
  job: { id: string; title: string } | null;
  status: 'NEW' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
  appliedAt: string;
  resumeUrl: string | null;
  notes: string;
  _count: { interviews: number };
}

interface Interview {
  id: string;
  candidate: { id: string; name: string; email: string };
  job: { id: string; title: string } | null;
  interviewer: { id: string; name: string; email: string } | null;
  type: 'PHONE' | 'VIDEO' | 'IN_PERSON' | 'TECHNICAL';
  scheduledAt: string;
  durationMin: number;
  meetingLink: string | null;
  location: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  rating: number | null;
  feedback: string | null;
}

interface Stats {
  openJobs: number;
  activeCandidates: number;
  hiresThisMonth: number;
  upcomingInterviews: number;
  byStatus: { status: string; _count: { _all: number } }[];
}

const JOB_STATUSES = ['DRAFT', 'OPEN', 'PAUSED', 'CLOSED'] as const;
const CANDIDATE_STATUSES = ['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'] as const;
const INTERVIEW_TYPES = ['PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL'] as const;

const jobVariant: Record<Job['status'], any> = { DRAFT: 'secondary', OPEN: 'success', PAUSED: 'warning', CLOSED: 'outline' };
const jobTypeVariant: Record<Job['type'], any> = { FULL_TIME: 'default', PART_TIME: 'secondary', CONTRACT: 'warning', INTERNSHIP: 'outline' };
const candVariant: Record<Candidate['status'], any> = {
  NEW: 'secondary', SCREENING: 'warning', INTERVIEW: 'default', OFFER: 'default',
  HIRED: 'success', REJECTED: 'destructive', WITHDRAWN: 'outline',
};
const interviewVariant: Record<Interview['status'], any> = { SCHEDULED: 'warning', COMPLETED: 'success', CANCELLED: 'outline' };

const emptyJobForm = {
  title: '', departmentId: '', type: 'FULL_TIME' as Job['type'], remote: false, location: '',
  slots: 1, description: '', requirements: '', salaryMin: '' as string, salaryMax: '' as string,
};

const emptyCandidateForm = { name: '', email: '', phone: '', source: '', jobId: '', notes: '' };
const emptyInterviewForm = {
  candidateId: '', jobId: '', interviewerId: '', type: 'VIDEO' as Interview['type'],
  scheduledAt: '', durationMin: 60, meetingLink: '', location: '',
};

export default function RecruitmentPage() {
  useRequireRole(['Admin', 'HR']);
  const { t } = useTranslation();
  const { addToast } = useToast();
  const isAdmin = getUser()?.role === 'Admin';
  const [tab, setTab] = useState<'jobs' | 'candidates' | 'interviews'>('jobs');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intervalFilter, setIntervalFilter] = useState<'upcoming' | 'past'>('upcoming');

  const [jobDialog, setJobDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobForm, setJobForm] = useState(emptyJobForm);
  const [candDialog, setCandDialog] = useState(false);
  const [candForm, setCandForm] = useState(emptyCandidateForm);
  const [intDialog, setIntDialog] = useState(false);
  const [intForm, setIntForm] = useState(emptyInterviewForm);
  const [feedbackFor, setFeedbackFor] = useState<Interview | null>(null);
  const [feedback, setFeedback] = useState({ rating: 5, text: '' });
  const [deleteCand, setDeleteCand] = useState<Candidate | null>(null);
  const [deleteJob, setDeleteJob] = useState<Job | null>(null);

  const { data: stats, refetch } = useApiGet<Stats>(['recruitment-stats'], '/recruitment/stats');
  const { data: depts } = useApiGet<{ id: string; name: string }[]>(['recruitment-depts'], '/departments');
  const { data: employees } = useApiGet<ListResponse<{ id: string; name: string }>>(['recruitment-employees'], '/employees?pageSize=100');

  const jobsQuery = useApiGet<ListResponse<Job>>(
    ['recruitment-jobs', statusFilter, search],
    `/recruitment/jobs?pageSize=100${statusFilter ? `&status=${statusFilter}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
  );
  const { data: candidatesData } = useApiGet<ListResponse<Candidate>>(
    ['recruitment-candidates', tab],
    tab === 'candidates' ? '/recruitment/candidates?pageSize=100' : null,
  );
  const nowIso = new Date().toISOString();
  const { data: interviewsData } = useApiGet<ListResponse<Interview>>(
    ['recruitment-interviews', intervalFilter],
    `/recruitment/interviews?pageSize=100${intervalFilter === 'upcoming' ? `&from=${nowIso}` : `&to=${nowIso}`}`,
  );

  const invalidateAll = [
    ['recruitment-stats'],
    ['recruitment-jobs', statusFilter, search],
    ['recruitment-candidates', tab],
    ['recruitment-interviews', intervalFilter],
    ['recruitment-depts'],
  ] as (string | number)[][];

  const createJob = useApiPost<any>(invalidateAll);
  const updateJob = useApiPut<any>(invalidateAll);
  const patchJob = useApiPatch<any>(invalidateAll);
  const removeJob = useApiDelete(invalidateAll);
  const createCand = useApiPost<any>(invalidateAll);
  const patchCand = useApiPatch<any>(invalidateAll);
  const removeCand = useApiDelete(invalidateAll);
  const createInt = useApiPost<any>(invalidateAll);
  const updateInt = useApiPut<any>(invalidateAll);
  const cancelInt = useApiPatch<any>(invalidateAll);
  const submitFeed = useApiPost<any>(invalidateAll);

  const jobs: Job[] = (jobsQuery.data as any)?.data || [];
  const candidates: Candidate[] = (candidatesData as any)?.data || [];
  const interviews: Interview[] = (interviewsData as any)?.data || [];
  const departmentOptions = depts || [];

  const countByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of candidates) map[c.status] = (map[c.status] ?? 0) + 1;
    return map;
  }, [candidates]);

  const openJobForm = (job?: Job) => {
    if (job) {
      setEditingJob(job);
      setJobForm({
        title: job.title, departmentId: job.departmentId ?? '', type: job.type, remote: job.remote,
        location: job.location ?? '', slots: job.slots, description: job.description,
        requirements: job.requirements,
        salaryMin: job.salaryMin !== null ? String(job.salaryMin) : '',
        salaryMax: job.salaryMax !== null ? String(job.salaryMax) : '',
      });
    } else {
      setEditingJob(null);
      setJobForm(emptyJobForm);
    }
    setJobDialog(true);
  };

  const saveJob = async () => {
    if (!jobForm.title.trim()) {
      addToast(t('Title is required'), 'error');
      return;
    }
    const payload = {
      title: jobForm.title.trim(),
      departmentId: jobForm.departmentId || null,
      type: jobForm.type,
      remote: jobForm.remote,
      location: jobForm.location || null,
      slots: Number(jobForm.slots) || 1,
      description: jobForm.description,
      requirements: jobForm.requirements,
      salaryMin: jobForm.salaryMin ? Number(jobForm.salaryMin) : null,
      salaryMax: jobForm.salaryMax ? Number(jobForm.salaryMax) : null,
    };
    try {
      if (editingJob) {
        await updateJob.mutateAsync({ endpoint: `/recruitment/jobs/${editingJob.id}`, data: payload });
        addToast(t('Job updated'));
      } else {
        await createJob.mutateAsync({ endpoint: '/recruitment/jobs', data: payload });
        addToast(t('Job created'));
      }
      setJobDialog(false);
    } catch {
      addToast(t('Save failed'), 'error');
    }
  };

  const changeJobStatus = async (job: Job, status: Job['status']) => {
    try {
      await patchJob.mutateAsync({ endpoint: `/recruitment/jobs/${job.id}/status`, data: { status } });
      addToast(t('Job updated'));
    } catch {
      addToast(t('Action failed'), 'error');
    }
  };

  const saveCandidate = async () => {
    if (!candForm.name.trim() || !candForm.email.trim()) {
      addToast(t('Name and email are required'), 'error');
      return;
    }
    try {
      await createCand.mutateAsync({
        endpoint: '/recruitment/candidates',
        data: { ...candForm, jobId: candForm.jobId || null, phone: candForm.phone || null },
      });
      addToast(t('Candidate added'));
      setCandDialog(false);
      setCandForm(emptyCandidateForm);
    } catch {
      addToast(t('Save failed'), 'error');
    }
  };

  const moveCandidate = async (candidate: Candidate, status: Candidate['status']) => {
    try {
      await patchCand.mutateAsync({ endpoint: `/recruitment/candidates/${candidate.id}/status`, data: { status } });
      addToast(t('Stage updated'));
    } catch {
      addToast(t('Action failed'), 'error');
    }
  };

  const saveInterview = async () => {
    if (!intForm.candidateId || !intForm.scheduledAt) {
      addToast(t('Candidate and time are required'), 'error');
      return;
    }
    const payload = {
      candidateId: intForm.candidateId,
      jobId: intForm.jobId || null,
      interviewerId: intForm.interviewerId || null,
      type: intForm.type,
      scheduledAt: new Date(intForm.scheduledAt).toISOString(),
      durationMin: Number(intForm.durationMin) || 60,
      meetingLink: intForm.meetingLink || null,
      location: intForm.location || null,
    };
    try {
      await createInt.mutateAsync({ endpoint: '/recruitment/interviews', data: payload });
      addToast(t('Interview scheduled'));
      setIntDialog(false);
      setIntForm(emptyInterviewForm);
    } catch {
      addToast(t('Save failed'), 'error');
    }
  };

  const submitInterviewFeedback = async () => {
    if (!feedbackFor) return;
    try {
      await submitFeed.mutateAsync({
        endpoint: `/recruitment/interviews/${feedbackFor.id}/feedback`,
        data: { rating: feedback.rating, feedback: feedback.text },
      });
      addToast(t('Feedback saved'));
      setFeedbackFor(null);
    } catch {
      addToast(t('Save failed'), 'error');
    }
  };

  const tabBtn = (key: 'jobs' | 'candidates' | 'interviews', label: string) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Recruitment')}
        description={t('Attract, track and hire talent')}
        actions={
          tab === 'jobs'
            ? <Button onClick={() => openJobForm()}>{t('New Job')}</Button>
            : tab === 'candidates'
              ? <Button onClick={() => setCandDialog(true)}>{t('Add Candidate')}</Button>
              : <Button onClick={() => setIntDialog(true)}>{t('Schedule Interview')}</Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard icon={Briefcase} title={t('Open Jobs')} value={stats?.openJobs ?? 0} index={0} />
        <StatsCard icon={Users} title={t('Active Candidates')} value={stats?.activeCandidates ?? 0} index={1} />
        <StatsCard icon={CalendarPlus} title={t('Upcoming Interviews')} value={stats?.upcomingInterviews ?? 0} index={2} />
        <StatsCard icon={CheckCircle} title={t('Hires This Month')} value={stats?.hiresThisMonth ?? 0} index={3} />
      </div>

      <div className="flex gap-1 rounded-xl border p-1 w-fit">
        {tabBtn('jobs', t('Jobs'))}
        {tabBtn('candidates', t('Candidates'))}
        {tabBtn('interviews', t('Interviews'))}
      </div>

      {tab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              className="max-w-xs"
              placeholder={t('Search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[180px]">
              <option value="">{t('All Statuses')}</option>
              {JOB_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
            </Select>
          </div>

          {jobsQuery.isLoading ? <TableSkeleton rows={4} /> : jobsQuery.error ? (
            <ErrorState message={t('Failed to load jobs')} onRetry={jobsQuery.refetch} />
          ) : jobs.length === 0 ? (
            <EmptyState icon={Briefcase} title={t('No jobs yet')} description={t('Create your first job posting to start recruiting')} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="h-full">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold leading-tight">{job.title}</h3>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {job.department && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{job.department.name}</span>}
                            {job.remote && <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{t('Remote')}</span>}
                          </div>
                        </div>
                        <Badge variant={jobVariant[job.status]}>{t(job.status)}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">{t(job.type)}</Badge>
                        {job.location && <Badge variant="outline"><MapPin className="h-3 w-3" />{job.location}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{job._count.candidates}/{job.slots} {t('hires')}</span>
                        {(job.salaryMin !== null || job.salaryMax !== null) && (
                          <span>${job.salaryMin ?? ''}–${job.salaryMax ?? ''}</span>
                        )}
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2">
                        {job.status !== 'OPEN' && (
                          <Button size="sm" variant="default" onClick={() => changeJobStatus(job, 'OPEN')}><Play className="h-3.5 w-3.5" />{t('Publish')}</Button>
                        )}
                        {job.status === 'OPEN' && (
                          <Button size="sm" variant="outline" onClick={() => changeJobStatus(job, 'PAUSED')}><Pause className="h-3.5 w-3.5" />{t('Pause')}</Button>
                        )}
                        {job.status !== 'CLOSED' && job.status !== 'DRAFT' && (
                          <Button size="sm" variant="outline" onClick={() => changeJobStatus(job, 'CLOSED')}><XCircle className="h-3.5 w-3.5" />{t('Close')}</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openJobForm(job)}><Pencil className="h-3.5 w-3.5" /></Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteJob(job)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'candidates' && (
        <div className="space-y-4">
          {jobsQuery.isLoading ? <TableSkeleton rows={3} /> : candidates.length === 0 ? (
            <EmptyState icon={Users} title={t('No candidates yet')} description={t('Add a candidate to start building your pipeline')} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {CANDIDATE_STATUSES.map((status) => (
                <div key={status} className="rounded-xl border bg-muted/40 p-3 min-h-[120px]">
                  <div className="mb-3 flex items-center justify-between">
                    <Badge variant={candVariant[status]}>{t(status)}</Badge>
                    <span className="text-xs text-muted-foreground">{countByStatus[status] ?? 0}</span>
                  </div>
                  <div className="space-y-2">
                    {candidates.filter((c) => c.status === status).map((c) => (
                      <Card key={c.id} className="shadow-sm">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                            </div>
                            {isAdmin && (
                              <button className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteCand(c)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {c.job && <p className="text-xs text-muted-foreground truncate">{c.job.title}</p>}
                          <div className="flex items-center gap-2">
                            <Select
                              className="h-7 text-xs py-0"
                              value={c.status}
                              onChange={(e) => moveCandidate(c, e.target.value as Candidate['status'])}
                            >
                              {CANDIDATE_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'interviews' && (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg border p-1 w-fit">
            <button onClick={() => setIntervalFilter('upcoming')} className={cn('rounded-md px-3 py-1 text-xs font-medium', intervalFilter === 'upcoming' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t('Upcoming')}</button>
            <button onClick={() => setIntervalFilter('past')} className={cn('rounded-md px-3 py-1 text-xs font-medium', intervalFilter === 'past' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t('Past')}</button>
          </div>

          {interviews.length === 0 ? (
            <EmptyState icon={CalendarPlus} title={t('No interviews')} description={t('Schedule an interview to get started')} />
          ) : (
            <div className="space-y-2">
              {interviews.map((iv) => (
                <Card key={iv.id}>
                  <CardContent className="p-4 flex flex-wrap items-center gap-4 justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{iv.candidate.name}</p>
                        <Badge variant={interviewVariant[iv.status]}>{t(iv.status)}</Badge>
                        {iv.rating !== null && (
                          <Badge variant="success"><Star className="h-3 w-3 fill-current" />{iv.rating}/5</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {iv.job && <span>{iv.job.title}</span>}
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(iv.scheduledAt)}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{iv.interviewer?.name ?? t('Unassigned')}</span>
                        <span>{t(iv.type)}</span>
                        {iv.meetingLink && <a href={iv.meetingLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Link2 className="h-3 w-3" />{t('Meeting Link')}</a>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {iv.status === 'SCHEDULED' && (
                        <>
                          <Button size="sm" variant="default" onClick={() => setFeedbackFor(iv)}><MessageSquare className="h-3.5 w-3.5" />{t('Add Feedback')}</Button>
                          <Button size="sm" variant="outline" onClick={() => cancelInt.mutateAsync({ endpoint: `/recruitment/interviews/${iv.id}/cancel`, data: {} }).then(() => addToast(t('Interview cancelled'))).catch(() => addToast(t('Action failed'), 'error'))}><XCircle className="h-3.5 w-3.5" />{t('Cancel')}</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Job dialog */}
      <Dialog open={jobDialog} onOpenChange={setJobDialog}>
        <DialogHeader>
          <DialogTitle>{editingJob ? t('Edit Job') : t('New Job')}</DialogTitle>
          <DialogDescription>{t('Job posting details')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>{t('Job Title')}</Label>
            <Input value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('Department')}</Label>
              <Select value={jobForm.departmentId} onChange={(e) => setJobForm({ ...jobForm, departmentId: e.target.value })}>
                <option value="">{t('None')}</option>
                {departmentOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('Employment Type')}</Label>
              <Select value={jobForm.type} onChange={(e) => setJobForm({ ...jobForm, type: e.target.value as Job['type'] })}>
                {JOB_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('Location')}</Label>
              <Input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} placeholder={t('e.g. Remote / Office')} />
            </div>
            <div className="space-y-2">
              <Label>{t('Openings')}</Label>
              <Input type="number" min={1} value={jobForm.slots} onChange={(e) => setJobForm({ ...jobForm, slots: Number(e.target.value) })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={jobForm.remote} onChange={(e) => setJobForm({ ...jobForm, remote: e.target.checked })} className="h-4 w-4 rounded border-input" />
            {t('Remote job')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('Salary Min')}</Label>
              <Input type="number" value={jobForm.salaryMin} onChange={(e) => setJobForm({ ...jobForm, salaryMin: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('Salary Max')}</Label>
              <Input type="number" value={jobForm.salaryMax} onChange={(e) => setJobForm({ ...jobForm, salaryMax: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('Description')}</Label>
            <Textarea rows={3} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('Requirements')}</Label>
            <Textarea rows={3} value={jobForm.requirements} onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setJobDialog(false)}>{t('Cancel')}</Button>
          <Button onClick={saveJob}>{t('Save')}</Button>
        </DialogFooter>
      </Dialog>

      {/* Candidate dialog */}
      <Dialog open={candDialog} onOpenChange={setCandDialog}>
        <DialogHeader>
          <DialogTitle>{t('Add Candidate')}</DialogTitle>
          <DialogDescription>{t('Add a candidate to your pipeline')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('Name')}</Label>
              <Input value={candForm.name} onChange={(e) => setCandForm({ ...candForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('Email')}</Label>
              <Input type="email" value={candForm.email} onChange={(e) => setCandForm({ ...candForm, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('Phone')}</Label>
              <Input value={candForm.phone} onChange={(e) => setCandForm({ ...candForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('Source')}</Label>
              <Input value={candForm.source} onChange={(e) => setCandForm({ ...candForm, source: e.target.value })} placeholder={t('e.g. LinkedIn')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('Applied For')}</Label>
            <Select value={candForm.jobId} onChange={(e) => setCandForm({ ...candForm, jobId: e.target.value })}>
              <option value="">{t('None')}</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Notes')}</Label>
            <Textarea rows={2} value={candForm.notes} onChange={(e) => setCandForm({ ...candForm, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCandDialog(false)}>{t('Cancel')}</Button>
          <Button onClick={saveCandidate}>{t('Save')}</Button>
        </DialogFooter>
      </Dialog>

      {/* Interview dialog */}
      <Dialog open={intDialog} onOpenChange={setIntDialog}>
        <DialogHeader>
          <DialogTitle>{t('Schedule Interview')}</DialogTitle>
          <DialogDescription>{t('Set up an interview round')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>{t('Candidate')}</Label>
            <Select value={intForm.candidateId} onChange={(e) => setIntForm({ ...intForm, candidateId: e.target.value })}>
              <option value="">{t('Select candidate')}</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('Job')}</Label>
              <Select value={intForm.jobId} onChange={(e) => setIntForm({ ...intForm, jobId: e.target.value })}>
                <option value="">{t('None')}</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('Interviewer')}</Label>
              <Select value={intForm.interviewerId} onChange={(e) => setIntForm({ ...intForm, interviewerId: e.target.value })}>
                <option value="">{t('Unassigned')}</option>
                {(employees as any)?.data?.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('Type')}</Label>
              <Select value={intForm.type} onChange={(e) => setIntForm({ ...intForm, type: e.target.value as Interview['type'] })}>
                {INTERVIEW_TYPES.map((ty) => <option key={ty} value={ty}>{t(ty)}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('Duration (min)')}</Label>
              <Input type="number" min={15} max={480} value={intForm.durationMin} onChange={(e) => setIntForm({ ...intForm, durationMin: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('Date & Time')}</Label>
            <Input type="datetime-local" value={intForm.scheduledAt} onChange={(e) => setIntForm({ ...intForm, scheduledAt: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('Meeting Link')}</Label>
              <Input value={intForm.meetingLink} onChange={(e) => setIntForm({ ...intForm, meetingLink: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('Location / Room')}</Label>
              <Input value={intForm.location} onChange={(e) => setIntForm({ ...intForm, location: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIntDialog(false)}>{t('Cancel')}</Button>
          <Button onClick={saveInterview}>{t('Schedule')}</Button>
        </DialogFooter>
      </Dialog>

      {/* Feedback dialog */}
      <Dialog open={!!feedbackFor} onOpenChange={(o) => !o && setFeedbackFor(null)}>
        <DialogHeader>
          <DialogTitle>{t('Interview Feedback')}</DialogTitle>
          <DialogDescription>{feedbackFor && `${feedbackFor.candidate.name} — ${feedbackFor.job?.title ?? ''}`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('Rating')}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setFeedback({ ...feedback, rating: n })} className={cn('rounded-md p-2 transition-colors', feedback.rating >= n ? 'text-amber-500' : 'text-muted-foreground')}>
                  <Star className={cn('h-6 w-6', feedback.rating >= n && 'fill-current')} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('Comments')}</Label>
            <Textarea rows={4} value={feedback.text} onChange={(e) => setFeedback({ ...feedback, text: e.target.value })} placeholder={t('Rate each criterion from 1 to 5')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFeedbackFor(null)}>{t('Cancel')}</Button>
          <Button onClick={submitInterviewFeedback}>{t('Submit')}</Button>
        </DialogFooter>
      </Dialog>

      {/* Delete dialogs */}
      <Dialog open={!!deleteJob} onOpenChange={(o) => !o && setDeleteJob(null)}>
        <DialogHeader>
          <DialogTitle>{t('Delete Job')}</DialogTitle>
          <DialogDescription>{t('Jobs with linked candidates cannot be deleted')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteJob(null)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={() => removeJob.mutateAsync(`/recruitment/jobs/${deleteJob?.id}`).then(() => { addToast(t('Job deleted')); setDeleteJob(null); }).catch(() => addToast(t('Delete failed'), 'error'))}>{t('Delete')}</Button>
        </DialogFooter>
      </Dialog>
      <Dialog open={!!deleteCand} onOpenChange={(o) => !o && setDeleteCand(null)}>
        <DialogHeader>
          <DialogTitle>{t('Delete Candidate')}</DialogTitle>
          <DialogDescription>{t('This will also remove their interviews')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteCand(null)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={() => removeCand.mutateAsync(`/recruitment/candidates/${deleteCand?.id}`).then(() => { addToast(t('Candidate deleted')); setDeleteCand(null); }).catch(() => addToast(t('Delete failed'), 'error'))}>{t('Delete')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
