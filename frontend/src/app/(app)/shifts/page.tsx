'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, Clock, Pencil, Trash2, UserPlus, UserX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut, useApiDelete } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { TableSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/tables/data-table';
import { z } from 'zod';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  description: string | null;
  _count?: { employees: number };
}

interface RotaEmployee {
  id: string;
  name: string;
  position: string | null;
  department: { name: string } | null;
  status: string;
}

const shiftSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM required'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM required'),
  description: z.string().optional(),
});

type ShiftForm = z.infer<typeof shiftSchema>;

export default function ShiftsPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rotaShift, setRotaShift] = useState<Shift | null>(null);
  const [rotaEmployees, setRotaEmployees] = useState<RotaEmployee[]>([]);
  const [assigned, setAssigned] = useState<RotaEmployee[]>([]);
  const [rotaLoading, setRotaLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rotaPick, setRotaPick] = useState<string[]>([]);

  const { data: shifts, isLoading, error, refetch } = useApiGet<Shift[]>(['shifts'], '/shifts');
  const createMutation = useApiPost<Shift>([['shifts']]);
  const updateMutation = useApiPut<Shift>([['shifts']]);
  const deleteMutation = useApiDelete([['shifts']]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
  });

  const openCreate = () => {
    setEditingId(null);
    reset({ name: '', startTime: '09:00', endTime: '17:00', description: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Shift) => {
    setEditingId(s.id);
    reset({ name: s.name, startTime: s.startTime, endTime: s.endTime, description: s.description || '' });
    setDialogOpen(true);
  };

  const onSubmit = async (data: ShiftForm) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ endpoint: `/shifts/${editingId}`, data });
        addToast(t('Shift updated'), 'success');
      } else {
        await createMutation.mutateAsync({ endpoint: '/shifts', data });
        addToast(t('Shift created'), 'success');
      }
      setDialogOpen(false);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(`/shifts/${deleteId}`);
      addToast(t('Shift deleted'), 'success');
      setDeleteId(null);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const openRota = async (s: Shift) => {
    setRotaShift(s);
    setRotaLoading(true);
    setAssigned([]);
    setRotaPick([]);
    try {
      const [empRes, assignedRes] = await Promise.all([
        api.get<RotaEmployee[]>('/shifts/unassigned'),
        api.get<RotaEmployee[]>(`/shifts/${s.id}/employees`),
      ]);
      setRotaEmployees(empRes.data ?? []);
      setAssigned(assignedRes.data ?? []);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setRotaLoading(false);
    }
  };

  const assignSelected = async (ids: string[]) => {
    if (!rotaShift || ids.length === 0) return;
    setBusy(true);
    try {
      await api.post(`/shifts/${rotaShift.id}/assign`, { employeeIds: ids });
      addToast(t('Shift assigned'), 'success');
      refetch();
      await openRota(rotaShift);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const unassignOne = async (employeeId: string) => {
    if (!rotaShift) return;
    setBusy(true);
    try {
      await api.delete(`/shifts/${rotaShift.id}/employees/${employeeId}`);
      addToast(t('Employee removed from shift'), 'success');
      refetch();
      await openRota(rotaShift);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Shifts')}
        description={t('Manage work shifts and schedules')}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> {t('New Shift')}
          </Button>
        }
      />

      {!shifts || shifts.length === 0 ? (
        <EmptyState icon={Clock} title={t('No shifts')} description={t('Create your first shift.')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shifts.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-sm text-muted-foreground">{s.startTime} - {s.endTime}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openRota(s)} title={t('Assign employees')}>
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {s.description && <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {s._count?.employees ?? 0} {t('employees')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingId ? t('Edit Shift') : t('New Shift')}</DialogTitle>
          <DialogDescription>{t('Define the shift times.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('Name')}</Label>
            <Input {...register('name')} placeholder="e.g. Morning Shift" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('Start')}</Label>
              <Input type="time" {...register('startTime')} />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('End')}</Label>
              <Input type="time" {...register('endTime')} />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('Description')}</Label>
            <Input {...register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? t('Update') : t('Create')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogHeader>
          <DialogTitle>{t('Delete Shift')}</DialogTitle>
          <DialogDescription>{t('Are you sure? Shifts with assigned employees cannot be deleted.')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={confirmDelete}>{t('Delete')}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!rotaShift} onOpenChange={(o) => !o && setRotaShift(null)}>
        <DialogHeader>
          <DialogTitle>{t('Assign Employees')} — {rotaShift?.name}</DialogTitle>
          <DialogDescription>{t('Build the roster for this shift. Employees keep one shift at a time.')}</DialogDescription>
        </DialogHeader>
        {rotaLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div>
              <p className="mb-2 text-sm font-medium">{t('Assigned employees')} ({assigned.length})</p>
              {assigned.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                  {t('No employees assigned yet')}
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {assigned.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.position ?? ''}{e.department?.name ? ` — ${e.department.name}` : ''}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0 text-destructive" disabled={busy} onClick={() => unassignOne(e.id)}>
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t('Available employees')} ({rotaEmployees.length})</p>
              {rotaEmployees.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                  {t('Everyone is assigned to a shift')}
                </p>
              ) : (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {rotaEmployees.map((e) => (
                    <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={rotaPick.includes(e.id)}
                        onChange={(ev) =>
                          setRotaPick((p) => ev.target.checked ? [...p, e.id] : p.filter((x) => x !== e.id))
                        }
                      />
                      <span className="text-sm">{e.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{e.department?.name ?? ''}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setRotaShift(null)}>{t('Close')}</Button>
          <Button disabled={busy || rotaPick.length === 0} onClick={() => assignSelected(rotaPick)}>
            {busy && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
            {t('Assign')} ({rotaPick.length})
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
