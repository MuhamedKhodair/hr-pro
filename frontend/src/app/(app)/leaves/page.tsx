'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, CalendarClock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut } from '@/hooks/useApi';
import { isAdminOrHr, getUser } from '@/lib/auth';
import { leaveSchema } from '@/lib/validations';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/tables/data-table';
import { formatDate } from '@/lib/utils';
import { z } from 'zod';

interface LeaveRequest {
  id: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  employee: { id: string; name: string; email: string };
  reviewer: { id: string; email: string } | null;
}

type LeaveForm = z.infer<typeof leaveSchema>;

export default function LeavesPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const canReview = isAdminOrHr();
  const currentUser = getUser();
  const myEmployeeId = currentUser?.employeeId || '';

  const { data: leaves, isLoading, error, refetch } = useApiGet<LeaveRequest[]>(['leaves'], canReview ? '/leaves' : '/leaves/my');
  const createMutation = useApiPost<LeaveRequest>([['leaves']]);
  const reviewMutation = useApiPut<LeaveRequest>([['leaves']]);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
  });

  const onSubmit = async (data: LeaveForm) => {
    try {
      const payload = canReview ? data : { ...data, employeeId: myEmployeeId };
      await createMutation.mutateAsync({ endpoint: '/leaves', data: payload });
      addToast(t('Leave request submitted'), 'success');
      setDialogOpen(false);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleReview = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await reviewMutation.mutateAsync({ endpoint: `/leaves/${id}/review`, data: { status } });
      addToast(t(`Leave ${status.toLowerCase()}`), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const filtered = filter
    ? leaves?.filter((l) => l.status === filter)
    : leaves;

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const statusVariant = (status: string) => {
    switch (status) {
      case 'Approved': return 'success' as const;
      case 'Rejected': return 'destructive' as const;
      default: return 'warning' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('Leave Requests')}</h1>
          <p className="text-muted-foreground">{t('Manage employee leave')}</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-32">
            <option value="">All</option>
            <option value="Pending">{t('Pending')}</option>
            <option value="Approved">{t('Approved')}</option>
            <option value="Rejected">{t('Rejected')}</option>
          </Select>
          <Button onClick={() => { reset({ employeeId: myEmployeeId, type: '', startDate: '', endDate: '', reason: '' }); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> {t('New Request')}
          </Button>
        </div>
      </div>

      {!filtered || filtered.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t('No leave requests')} description={t('Submit a new leave request.')} />
      ) : (
        <>
          <div className="hidden sm:block rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Employee')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Type')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Dates')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Reason')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Status')}</th>
                  <th className="px-4 py-3 text-end text-sm font-medium">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((leave, i) => (
                  <motion.tr
                    key={leave.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium">{leave.employee.name}</td>
                    <td className="px-4 py-3 text-sm">{leave.type}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                      {leave.reason}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusVariant(leave.status)}>{t(leave.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-end">
                      {canReview && leave.status === 'Pending' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleReview(leave.id, 'Approved')}>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleReview(leave.id, 'Rejected')}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:hidden">
            {filtered.map((leave, i) => (
              <motion.div
                key={leave.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{leave.employee.name}</p>
                          <p className="text-sm text-muted-foreground">{leave.type}</p>
                        </div>
                        <Badge variant={statusVariant(leave.status)}>{t(leave.status)}</Badge>
                      </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                    </p>
                    <p className="mt-1 text-sm">{leave.reason}</p>
                    {canReview && leave.status === 'Pending' && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => handleReview(leave.id, 'Approved')}>{t('Approve')}</Button>
                        <Button size="sm" variant="outline" onClick={() => handleReview(leave.id, 'Rejected')}>{t('Reject')}</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{t('New Request')}</DialogTitle>
          <DialogDescription>{t('Submit a leave request.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('Employee ID')}</Label>
            <Input {...register('employeeId')} placeholder={t('Employee ID')} disabled={!canReview} />
            {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t('Leave Type')}</Label>
            <Select {...register('type')}>
              <option value="">{t('Select type')}</option>
              <option value="Vacation">{t('Vacation')}</option>
              <option value="Sick">{t('Sick')}</option>
              <option value="Personal">{t('Personal')}</option>
              <option value="Other">{t('Other')}</option>
            </Select>
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('Start Date')}</Label>
              <Input type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('End Date')}</Label>
              <Input type="date" {...register('endDate')} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('Reason')}</Label>
            <Textarea {...register('reason')} />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" disabled={createMutation.isPending}>{t('Submit')}</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
