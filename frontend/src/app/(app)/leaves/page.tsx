'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, CalendarClock, CheckCircle, XCircle, Download, Paperclip, FileText, Pencil, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportActions } from '@/components/reports/export-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut, useApiPatch } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { isAdminOrHr, getUser } from '@/lib/auth';
import { leaveSchema } from '@/lib/validations';
import { TableSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/tables/data-table';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/tables/table';
import { formatDate } from '@/lib/utils';
import { z } from 'zod';

interface LeaveRequest {
  id: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  totalDays: number;
  reason: string;
  status: string;
  isCancelled: boolean;
  cancelReason: string | null;
  reviewComment: string | null;
  attachmentUrl: string | null;
  employee: { id: string; name: string; email: string };
  reviewer: { id: string; email: string } | null;
}

interface Employee {
  id: string;
  name: string;
}

interface LeaveBalance {
  type: string;
  entitlement: number;
  used: number;
  remaining: number;
}

interface BalancesResponse {
  year: number;
  balances: LeaveBalance[];
  pendingRequests: number;
}

type LeaveForm = z.infer<typeof leaveSchema>;
const apiPath = (url: string) => url.replace(/^\/api/, '');

export default function LeavesPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reviewTarget, setReviewTarget] = useState<LeaveRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'Approved' | 'Rejected'>('Approved');
  const [reviewComment, setReviewComment] = useState('');

  const canReview = isAdminOrHr();
  const currentUser = getUser();
  const myEmployeeId = currentUser?.employeeId || '';
  const canManage = canReview;

  const { data: leaves, isLoading, error, refetch } = useApiGet<LeaveRequest[]>(
    ['leaves'],
    canManage ? '/leaves' : '/leaves/my',
  );
  const { data: employees } = useApiGet<Employee[]>(['employees-min'], canReview ? '/employees' : null);
  const { data: myBalances } = useApiGet<BalancesResponse>(
    ['my-balances'],
    myEmployeeId ? `/leaves/balances?employeeId=${myEmployeeId}` : null,
  );
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
  });

  const selectedEmpId = watch('employeeId');
  const { data: dialogBalances } = useApiGet<BalancesResponse>(
    ['dialog-balances', selectedEmpId],
    canReview && selectedEmpId ? `/leaves/balances?employeeId=${selectedEmpId}` : null,
  );

  const createMutation = useApiPost<LeaveRequest>([['leaves']]);
  const updateMutation = useApiPut<LeaveRequest>([['leaves']]);
  const cancelMutation = useApiPatch<LeaveRequest>([['leaves']]);
  const reviewMutation = useApiPut<LeaveRequest>([['leaves']]);

  const resetForm = () => {
    reset({ employeeId: myEmployeeId, type: '', startDate: '', endDate: '', reason: '', halfDayStart: false, halfDayEnd: false });
    setAttachmentUrl('');
    setAttachmentName('');
    setEditId(null);
  };

  const handleNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (leave: LeaveRequest) => {
    reset({
      employeeId: leave.employeeId,
      type: leave.type,
      startDate: leave.startDate.slice(0, 10),
      endDate: leave.endDate.slice(0, 10),
      reason: leave.reason,
      halfDayStart: leave.halfDayStart,
      halfDayEnd: leave.halfDayEnd,
      attachmentUrl: leave.attachmentUrl ?? '',
    });
    setAttachmentUrl(leave.attachmentUrl ?? '');
    setAttachmentName(leave.attachmentUrl ? leave.attachmentUrl.split('/').pop()! : '');
    setEditId(leave.id);
    setDialogOpen(true);
  };

  const onSubmit = async (data: LeaveForm) => {
    try {
      if (editId) {
        await updateMutation.mutateAsync({ endpoint: `/leaves/${editId}`, data });
        addToast(t('Leave request updated'), 'success');
      } else {
        const payload = canReview ? data : { ...data, employeeId: myEmployeeId };
        await createMutation.mutateAsync({ endpoint: '/leaves', data: payload });
        addToast(t('Leave request submitted'), 'success');
      }
      setDialogOpen(false);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await api.upload<{ url: string; fileName: string }>('/uploads/leave', file);
      if (res.data) {
        setAttachmentUrl(res.data.url);
        setAttachmentName(res.data.fileName);
        setValue('attachmentUrl', res.data.url);
      }
      addToast(t('Attachment uploaded'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync({ endpoint: `/leaves/${cancelTarget.id}/cancel`, data: { cancelReason } });
      addToast(t('Leave request cancelled'), 'success');
      setCancelTarget(null);
      setCancelReason('');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    try {
      await reviewMutation.mutateAsync({
        endpoint: `/leaves/${reviewTarget.id}/review`,
        data: { status: reviewStatus, comment: reviewComment || undefined },
      });
      addToast(t(`Leave ${reviewStatus.toLowerCase()}`), 'success');
      setReviewTarget(null);
      setReviewComment('');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      await api.download('/leaves/export/csv', `leaves-${new Date().toISOString().split('T')[0]}.csv`);
      addToast(t('Exported to CSV'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const openAttachment = async (url: string) => {
    try {
      const filename = url.split('/').pop() || 'attachment';
      await api.download(apiPath(url), filename);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const filtered = filter ? leaves?.filter((l) => l.status === filter) : leaves;

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const statusVariant = (status: string) => {
    switch (status) {
      case 'Approved': return 'success' as const;
      case 'Rejected': return 'destructive' as const;
      default: return 'warning' as const;
    }
  };

  const displayStatus = (leave: LeaveRequest) => (leave.isCancelled ? 'Cancelled' : leave.status);

  const isOwnPending = (leave: LeaveRequest) =>
    !canReview && leave.employeeId === myEmployeeId && leave.status === 'Pending' && !leave.isCancelled;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Leave Requests')}
        description={t('Manage employee leave')}
        actions={
          <>
            {canReview && (
              <>
                <ExportActions
                  excelPath="/leaves/export/xlsx"
                  excelFilename={`leaves-${new Date().toISOString().split('T')[0]}.xlsx`}
                  printPath="type=leaves"
                />
                <Button variant="outline" onClick={handleExportCsv} className="gap-2">
                  <Download className="h-4 w-4" /> {t('Export CSV')}
                </Button>
              </>
            )}
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" /> {t('New Request')}
            </Button>
          </>
        }
      />

      <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-32">
        <option value="">All</option>
        <option value="Pending">{t('Pending')}</option>
        <option value="Approved">{t('Approved')}</option>
        <option value="Rejected">{t('Rejected')}</option>
      </Select>

      {myBalances && myBalances.balances.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {myBalances.balances.map((b) => {
            const pct = b.entitlement > 0 ? Math.min(100, (b.used / b.entitlement) * 100) : 0;
            return (
              <Card key={b.type}>
                <CardContent className="pt-5">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{t(b.type)}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {b.used} / {b.entitlement} {t('days')}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t('Remaining')}: <span className="font-semibold text-foreground">{b.remaining}</span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
          {myBalances.pendingRequests > 0 && (
            <Card>
              <CardContent className="flex items-center justify-between pt-5">
                <span className="text-sm font-medium">{t('Pending')}</span>
                <span className="font-mono text-xl font-bold text-amber-600">{myBalances.pendingRequests}</span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!filtered || filtered.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t('No leave requests')} description={t('Submit a new leave request.')} />
      ) : (
        <>
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Employee')}</TableHead>
                  <TableHead>{t('Type')}</TableHead>
                  <TableHead>{t('Dates')}</TableHead>
                  <TableHead>{t('Days')}</TableHead>
                  <TableHead>{t('Reason')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead className="text-end">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((leave, i) => (
                  <motion.tr
                    key={leave.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <TableCell className="font-medium">{leave.employee.name}</TableCell>
                    <TableCell>{leave.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                    </TableCell>
                    <TableCell>
                      {leave.totalDays}{leave.halfDayStart || leave.halfDayEnd ? ' (½)' : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {leave.reason}
                      {leave.attachmentUrl && (
                        <button
                          onClick={() => openAttachment(leave.attachmentUrl!)}
                          className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                          title={t('Open attachment')}
                        >
                          <Paperclip className="h-3 w-3" />
                        </button>
                      )}
                      {leave.reviewComment && (
                        <p className="mt-1 text-xs text-muted-foreground italic">"{leave.reviewComment}"</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={leave.isCancelled ? 'secondary' : statusVariant(leave.status)}>
                        {t(displayStatus(leave))}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        {canManage && leave.status === 'Pending' && !leave.isCancelled && (
                          <>
                            <Button
                              size="sm" variant="ghost"
                              title={t('Approve')}
                              onClick={() => { setReviewTarget(leave); setReviewStatus('Approved'); }}
                            >
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              title={t('Reject')}
                              onClick={() => { setReviewTarget(leave); setReviewStatus('Rejected'); }}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {isOwnPending(leave) && (
                          <>
                            <Button size="sm" variant="ghost" title={t('Edit')} onClick={() => handleEdit(leave)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button size="sm" variant="ghost" title={t('Cancel request')} onClick={() => setCancelTarget(leave)}>
                              <Ban className="h-4 w-4 text-amber-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
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
                      <Badge variant={leave.isCancelled ? 'secondary' : statusVariant(leave.status)}>
                        {t(displayStatus(leave))}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)} ({leave.totalDays} {t('days')})
                    </p>
                    <p className="mt-1 text-sm">{leave.reason}</p>
                    {leave.attachmentUrl && (
                      <button onClick={() => openAttachment(leave.attachmentUrl!)} className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <Paperclip className="h-3 w-3" /> {t('Attachment')}
                      </button>
                    )}
                    {leave.reviewComment && (
                      <p className="mt-1 text-xs text-muted-foreground italic">"{leave.reviewComment}"</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {canManage && leave.status === 'Pending' && !leave.isCancelled && (
                        <>
                          <Button size="sm" onClick={() => { setReviewTarget(leave); setReviewStatus('Approved'); }}>{t('Approve')}</Button>
                          <Button size="sm" variant="outline" onClick={() => { setReviewTarget(leave); setReviewStatus('Rejected'); }}>{t('Reject')}</Button>
                        </>
                      )}
                      {isOwnPending(leave) && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(leave)}>{t('Edit')}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setCancelTarget(leave)}>{t('Cancel')}</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editId ? t('Edit Request') : t('New Request')}</DialogTitle>
          <DialogDescription>
            {editId ? t('Update your leave request.') : t('Submit a leave request.')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {canReview && (
            <div className="space-y-2">
              <Label>{t('Employee')}</Label>
              <Select {...register('employeeId')}>
                <option value="">{t('Select employee')}</option>
                {employees?.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </Select>
              {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
            </div>
          )}
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
            <DialogBalance
              type={watch('type')}
              balances={canReview ? dialogBalances?.balances : myBalances?.balances}
            />
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
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('halfDayStart')} className="h-4 w-4 rounded border-border" />
              {t('Half day start')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('halfDayEnd')} className="h-4 w-4 rounded border-border" />
              {t('Half day end')}
            </label>
          </div>
          <div className="space-y-2">
            <Label>{t('Reason')}</Label>
            <Textarea {...register('reason')} />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t('Attachment')} <span className="text-muted-foreground text-xs">({t('optional')})</span></Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={isUploading}
                onChange={(e) => handleUpload(e.target.files?.[0])}
                className="max-w-sm"
              />
              {isUploading && <span className="text-xs text-muted-foreground">{t('Uploading...')}</span>}
              {attachmentName && (
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <FileText className="h-3.5 w-3.5" /> {attachmentName}
                </span>
              )}
            </div>
            <input type="hidden" {...register('attachmentUrl')} value={attachmentUrl} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || isUploading}>
              {editId ? t('Save Changes') : t('Submit')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(''); } }}>
        <DialogHeader>
          <DialogTitle>{t('Cancel Request')}</DialogTitle>
          <DialogDescription>{t('Provide a reason for cancelling this request.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('Cancel reason')}</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>{t('Back')}</Button>
            <Button type="button" variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending || !cancelReason}>
              {t('Confirm Cancel')}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={(o) => { if (!o) { setReviewTarget(null); setReviewComment(''); } }}>
        <DialogHeader>
          <DialogTitle>{reviewStatus === 'Approved' ? t('Approve Request') : t('Reject Request')}</DialogTitle>
          <DialogDescription>{t('Add an optional comment for this decision.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {reviewTarget && (
            <p className="text-sm text-muted-foreground">
              {reviewTarget.employee.name} — {reviewTarget.type} ({formatDate(reviewTarget.startDate)} → {formatDate(reviewTarget.endDate)})
            </p>
          )}
          <div className="space-y-2">
            <Label>{t('Comment')} <span className="text-muted-foreground text-xs">({t('optional')})</span></Label>
            <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewTarget(null)}>{t('Back')}</Button>
            <Button
              type="button"
              variant={reviewStatus === 'Approved' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={reviewMutation.isPending}
            >
              {reviewStatus === 'Approved' ? t('Approve') : t('Reject')}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}

function DialogBalance({ type, balances }: { type: string; balances?: LeaveBalance[] }) {
  const { t } = useTranslation();
  const bal = balances?.find((b) => b.type === type);
  if (!bal) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {t('Remaining')}:{' '}
      <span className={`font-semibold ${bal.remaining > 0 ? 'text-foreground' : 'text-destructive'}`}>
        {bal.remaining} {t('days')}
      </span>
    </p>
  );
}
