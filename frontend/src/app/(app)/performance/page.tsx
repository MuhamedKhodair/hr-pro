'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useRequireRole } from '@/hooks/useRequireRole';

import { motion } from 'framer-motion';
import { Plus, Target, Star, ClipboardCheck, FileEdit, Trash2, Pencil, CheckCircle, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut, useApiDelete } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { TableSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/tables/data-table';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartTooltip } from '@/components/dashboard/chart-tooltip';

interface Criterion {
  label: string;
  score: number;
}

interface Review {
  id: string;
  employeeId: string;
  reviewerId: string | null;
  periodName: string;
  status: 'DRAFT' | 'COMPLETED';
  criteria: Criterion[];
  overallScore: number;
  strengths: string;
  improvements: string;
  goals: string;
  reviewComment: string;
  completedAt: string | null;
  createdAt: string;
  employee: { id: string; name: string; email: string; department: string | null } | null;
  reviewer: { id: string; name: string; email: string } | null;
}

interface Stats {
  total: number;
  completed: number;
  drafts: number;
  employeeCount: number;
  average: number;
  byDepartment: { name: string; average: number }[];
  distribution: { range: string; label: string; count: number }[];
}

interface EmployeeOption {
  id: string;
  name: string;
}

const scoreVariant = (score: number) =>
  score >= 4 ? 'success' : score >= 3 ? 'warning' : 'destructive';

function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge variant={scoreVariant(score)} className="gap-1 tabular-nums">
      <Star className="h-3 w-3 fill-current" /> {score.toFixed(1)}
    </Badge>
  );
}

export default function PerformancePage() {
  useRequireRole(['Admin', 'HR']);
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeComment, setCompleteComment] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    employeeId: '',
    reviewerId: '',
    periodName: '',
    criteria: [] as Criterion[],
    strengths: '',
    improvements: '',
    goals: '',
  });

  const baseKey = ['performance', periodFilter, statusFilter, search];
  const listEndpoint = `/performance?periodName=${periodFilter}${statusFilter ? `&status=${statusFilter}` : ''}`;
  const { data: reviews, isLoading, error, refetch } = useApiGet<Review[]>(
    ['performance', periodFilter, statusFilter],
    listEndpoint,
  );
  const { data: stats } = useApiGet<Stats>(['performance-stats'], '/performance/stats');
  const { data: periods } = useApiGet<string[]>(['performance-periods'], '/performance/periods');
  const { data: employees } = useApiGet<any>(['employees-options'], '/employees?pageSize=100');
  const employeeOptions: EmployeeOption[] = ((employees as any)?.data || []).map((e: any) => ({
    id: e.id,
    name: e.name,
  }));

  const createMutation = useApiPost<any>([baseKey, ['performance-stats'], ['performance-periods']]);  const updateMutation = useApiPut<any>([baseKey, ['performance-stats']]);
  const completeMutation = useApiPost<any>([baseKey, ['performance-stats']]);
  const deleteMutation = useApiDelete([baseKey, ['performance-stats'], ['performance-periods']]);

  useEffect(() => {
    if (periods && !periodFilter) {
      /* keep filter empty (All Periods) */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      employeeId: '',
      reviewerId: '',
      periodName: '',
      criteria: [
        { label: 'Quality of Work', score: 3 },
        { label: 'Productivity', score: 3 },
        { label: 'Teamwork', score: 3 },
        { label: 'Communication', score: 3 },
        { label: 'Attendance & Punctuality', score: 3 },
        { label: 'Initiative', score: 3 },
      ],
      strengths: '',
      improvements: '',
      goals: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (r: Review) => {
    setEditingId(r.id);
    setForm({
      employeeId: r.employeeId,
      reviewerId: r.reviewerId || '',
      periodName: r.periodName,
      criteria: r.criteria,
      strengths: r.strengths,
      improvements: r.improvements,
      goals: r.goals,
    });
    setDialogOpen(true);
  };

  const setCriterion = (index: number, score: number) => {
    setForm((f) => ({
      ...f,
      criteria: f.criteria.map((c, i) => (i === index ? { ...c, score } : c)),
    }));
  };

  const handleSave = async () => {
    if (!form.employeeId || !form.periodName.trim()) {
      addToast(t('Employee and period are required'), 'error');
      return;
    }
    try {
      const payload = {
        employeeId: form.employeeId,
        reviewerId: form.reviewerId || null,
        periodName: form.periodName.trim(),
        criteria: form.criteria,
        strengths: form.strengths,
        improvements: form.improvements,
        goals: form.goals,
      };
      if (editingId) {
        await updateMutation.mutateAsync({ endpoint: `/performance/${editingId}`, data: payload });
      } else {
        await createMutation.mutateAsync({ endpoint: '/performance', data: payload });
      }
      addToast(t('Review saved'), 'success');
      setDialogOpen(false);
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    }
  };

  const handleComplete = async () => {
    if (!completeId) return;
    try {
      await completeMutation.mutateAsync({
        endpoint: `/performance/${completeId}/complete`,
        data: { reviewComment: completeComment },
      });
      addToast(t('Review completed'), 'success');
      setCompleteId(null);
      setCompleteComment('');
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(`/performance/${deleteId}`);
      addToast(t('Review deleted'), 'success');
      setDeleteId(null);
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    }
  };

  const filtered = (reviews || []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.employee?.name || '').toLowerCase().includes(q) ||
      (r.employee?.department || '').toLowerCase().includes(q) ||
      (r.reviewer?.name || '').toLowerCase().includes(q) ||
      r.periodName.toLowerCase().includes(q)
    );
  });

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Performance Reviews')}
        description={t('Evaluate employee performance with periodic reviews')}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> {t('New Review')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('Average Score')}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">
                  {stats ? stats.average.toFixed(1) : '–'}
                  <span className="text-sm font-normal text-muted-foreground"> / 5</span>
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Star className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('Total Reviews')}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">
                  {stats ? <AnimatedCounter value={stats.total} /> : '–'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('Completed Reviews')}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">
                  {stats ? <AnimatedCounter value={stats.completed} /> : '–'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('Draft Reviews')}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">
                  {stats ? <AnimatedCounter value={stats.drafts} /> : '–'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <FileEdit className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-[15px]">{t('Average score by department')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.byDepartment.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.byDepartment} barSize={26}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" className="chart-grad-a" />
                      <stop offset="100%" className="chart-grad-b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip formatter={(v) => `${Number(v).toFixed(1)} / 5`} />} />
                  <Bar dataKey="average" fill="url(#perfGrad)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('No data')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-[15px]">{t('Score distribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.distribution.length > 0 ? (
              <div className="space-y-3">
                {stats.distribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="w-8 text-xs font-medium text-muted-foreground tabular-nums">{d.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.total ? (d.count / stats.total) * 100 : 0}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                    <span className="w-8 text-end text-xs tabular-nums text-muted-foreground">{d.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('No data')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className="w-44">
              <option value="">{t('All Periods')}</option>
              {(periods || []).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
              <option value="">{t('All Statuses')}</option>
              <option value="DRAFT">{t('Draft')}</option>
              <option value="COMPLETED">{t('Completed')}</option>
            </Select>
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search')}
                className="ps-9 w-52"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Target}
              title={t('No reviews yet')}
              description={t('Create the first performance review.')}
            />
          ) : (
            <div className="data-table-wrap overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>{t('Employee')}</th>
                    <th>{t('Department')}</th>
                    <th>{t('Period')}</th>
                    <th>{t('Reviewer')}</th>
                    <th>{t('Overall Score')}</th>
                    <th>{t('Status')}</th>
                    <th>{t('Date')}</th>
                    <th className="text-end">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.employee?.name ?? '—'}</td>
                      <td>{r.employee?.department ?? '—'}</td>
                      <td>{r.periodName}</td>
                      <td>{r.reviewer?.name ?? '—'}</td>
                      <td><ScoreBadge score={r.overallScore} /></td>
                      <td>
                        <Badge variant={r.status === 'COMPLETED' ? 'success' : 'warning'}>
                          {t(r.status === 'COMPLETED' ? 'Completed' : 'Draft')}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-end">
                        <div className="flex justify-end gap-1">
                          {r.status === 'DRAFT' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title={t('Edit Review')}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setCompleteId(r.id); setCompleteComment(''); }} title={t('Complete Review')}>
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} title={t('Delete Review')}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingId ? t('Edit Review') : t('New Review')}</DialogTitle>
          <DialogDescription>{t('Rate each criterion from 1 to 5')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('Employee')} *</Label>
              <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">{t('Select employee')}</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('Reviewer')} <span className="text-xs text-muted-foreground">({t('Optional')})</span></Label>
              <Select value={form.reviewerId} onChange={(e) => setForm({ ...form, reviewerId: e.target.value })}>
                <option value="">—</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Period')} *</Label>
            <Input
              value={form.periodName}
              onChange={(e) => setForm({ ...form, periodName: e.target.value })}
              placeholder={t('Period name e.g. Q1 2026')}
              list="period-list"
            />
            <datalist id="period-list">
              {(periods || []).map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Criteria')}</p>
            {form.criteria.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                <span className="text-[13px]">{c.label}</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCriterion(i, s)}
                      className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${
                        c.score >= s
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground tabular-nums">
              {t('Overall Score')}:{' '}
              <span className="font-semibold text-foreground">
                {(form.criteria.reduce((acc, c) => acc + c.score, 0) / Math.max(form.criteria.length, 1)).toFixed(1)}
              </span> / 5
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('Strengths')}</Label>
            <Textarea value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Areas for improvement')}</Label>
            <Textarea value={form.improvements} onChange={(e) => setForm({ ...form, improvements: e.target.value })} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Goals for next period')}</Label>
            <Textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
          <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            {t('Save')}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!completeId} onOpenChange={(o) => !o && setCompleteId(null)}>
        <DialogHeader>
          <DialogTitle>{t('Complete Review')}</DialogTitle>
          <DialogDescription>{t('Complete this review to finalize the scores.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>{t('Final comment')}</Label>
          <Textarea value={completeComment} onChange={(e) => setCompleteComment(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCompleteId(null)}>{t('Cancel')}</Button>
          <Button onClick={handleComplete} disabled={completeMutation.isPending}>
            <CheckCircle className="h-4 w-4 mr-2" /> {t('Complete Review')}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogHeader>
          <DialogTitle>{t('Delete Review')}</DialogTitle>
          <DialogDescription>{t('Are you sure? This will permanently delete the review.')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {t('Delete')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
