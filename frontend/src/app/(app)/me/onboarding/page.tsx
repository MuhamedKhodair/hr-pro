'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ClipboardList, Play, Circle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useApiGet, useApiPatch } from '@/hooks/useApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/tables/data-table';
import { useToast } from '@/components/ui/toast';

type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

interface OnboardingTask {
  id: string;
  name: string;
  description: string;
  category: string;
  required: boolean;
  orderIndex: number;
}

interface Assignment {
  id: string;
  status: AssignmentStatus;
  completedAt: string | null;
  task: OnboardingTask;
}

const statusBadge: Record<AssignmentStatus, 'secondary' | 'default' | 'success'> = {
  PENDING: 'secondary',
  IN_PROGRESS: 'default',
  COMPLETED: 'success',
};

export default function MyOnboardingPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { data: assignments, isLoading, error, refetch } = useApiGet<Assignment[]>(['my-onboarding'], '/onboarding/assignments');
  const [busyId, setBusyId] = useState<string | null>(null);
  const statusMutation = useApiPatch<Assignment>([['my-onboarding']]);

  const progress = useMemo(() => {
    if (!assignments || assignments.length === 0) return { completed: 0, total: 0, pct: 0 };
    const completed = assignments.filter((a) => a.status === 'COMPLETED').length;
    return { completed, total: assignments.length, pct: Math.round((completed / assignments.length) * 100) };
  }, [assignments]);

  const setStatus = async (assignment: Assignment, status: AssignmentStatus) => {
    setBusyId(assignment.id);
    try {
      await statusMutation.mutateAsync({
        endpoint: `/onboarding/assignments/${assignment.id}/status`,
        data: { status },
      });
      addToast(status === 'COMPLETED' ? t('Task completed') : t('Task started'), 'success');
      refetch();
    } catch (err: any) {
      addToast(err.message || t('Action failed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('My Onboarding')} description={t('Track and complete your onboarding checklist.')} />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : !assignments || assignments.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t('No onboarding tasks')} description={t('Your checklist will appear here once it has been generated.')} />
      ) : (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('Progress')}</p>
                  <p className="mt-1 font-display text-2xl font-semibold">
                    {progress.completed} / {progress.total}
                  </p>
                </div>
                <p className="text-3xl font-semibold text-primary">{progress.pct}%</p>
              </div>
              <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.pct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {assignments.map((assignment, i) => (
              <motion.div
                key={assignment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      {assignment.status === 'COMPLETED' ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      ) : assignment.status === 'IN_PROGRESS' ? (
                        <Play className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {assignment.task.name}
                          {assignment.task.required && <Badge variant="destructive">{t('Required')}</Badge>}
                        </p>
                        {assignment.task.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{assignment.task.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={statusBadge[assignment.status]}>
                        {assignment.status === 'PENDING' ? t('Pending') : assignment.status === 'IN_PROGRESS' ? t('In Progress') : t('Completed')}
                      </Badge>
                      {assignment.status !== 'COMPLETED' && (
                        <Button
                          size="sm"
                          variant={assignment.status === 'PENDING' ? 'outline' : 'default'}
                          disabled={busyId === assignment.id}
                          onClick={() => setStatus(assignment, assignment.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED')}
                        >
                          {assignment.status === 'PENDING' ? t('Start') : t('Mark complete')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}