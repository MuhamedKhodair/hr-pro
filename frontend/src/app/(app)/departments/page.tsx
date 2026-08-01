'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut, useApiDelete } from '@/hooks/useApi';
import { isAdminOrHr } from '@/lib/auth';
import { departmentSchema } from '@/lib/validations';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/tables/data-table';
import { z } from 'zod';

interface Department {
  id: string;
  name: string;
  description: string | null;
  _count: { employees: number };
}

type DeptForm = z.infer<typeof departmentSchema>;

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const canManage = isAdminOrHr();

  const { data: departments, isLoading, error, refetch } = useApiGet<Department[]>(['departments'], '/departments');
  const createMutation = useApiPost<Department>([['departments']]);
  const updateMutation = useApiPut<Department>([['departments']]);
  const deleteMutation = useApiDelete([['departments']]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DeptForm>({
    resolver: zodResolver(departmentSchema),
  });

  const openCreate = () => {
    setEditingId(null);
    reset({ name: '', description: '' });
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditingId(dept.id);
    reset({ name: dept.name, description: dept.description || '' });
    setDialogOpen(true);
  };

  const onSubmit = async (data: DeptForm) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ endpoint: `/departments/${editingId}`, data });
        addToast('Department updated', 'success');
      } else {
        await createMutation.mutateAsync({ endpoint: '/departments', data });
        addToast('Department created', 'success');
      }
      setDialogOpen(false);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(`/departments/${deleteId}`);
      addToast('Department deleted', 'success');
      setDeleteId(null);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('Departments')}</h1>
          <p className="text-muted-foreground">{t('Organize your company structure')}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> {t('Add Department')}
          </Button>
        )}
      </div>

      {!departments || departments.length === 0 ? (
        <EmptyState icon={Building2} title={t('No departments')} description={t('Create your first department.')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept, i) => (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{dept.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{dept.description || t('No description')}</p>
                      <p className="text-xs text-muted-foreground mt-2">{dept._count.employees} {t('employees')}</p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(dept.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingId ? t('Edit Department') : t('Add Department')}</DialogTitle>
          <DialogDescription>Fill in the details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('Name')}</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t('Description')}</Label>
            <Textarea {...register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit">{t('Save')}</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogHeader>
          <DialogTitle>{t('Delete Department')}</DialogTitle>
          <DialogDescription>{t('Departments with employees cannot be deleted.')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={confirmDelete}>{t('Delete')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
