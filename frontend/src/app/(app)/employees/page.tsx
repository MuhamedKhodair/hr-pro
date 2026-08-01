'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, Users, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut, useApiDelete } from '@/hooks/useApi';
import { isAdminOrHr, getUser } from '@/lib/auth';
import { employeeSchema } from '@/lib/validations';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/tables/data-table';
import { formatCurrency } from '@/lib/utils';
import { z } from 'zod';

interface Department {
  id: string;
  name: string;
  _count: { employees: number };
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  departmentId: string | null;
  position: string;
  hireDate: string;
  salary: number;
  status: string;
  department: Department | null;
}

type EmployeeForm = z.infer<typeof employeeSchema>;

export default function EmployeesPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const canManage = isAdminOrHr();

  const { data: employees, isLoading, error, refetch } = useApiGet<Employee[]>(['employees'], '/employees');
  const { data: departments } = useApiGet<Department[]>(['departments'], '/departments');

  const createMutation = useApiPost<Employee>([['employees']]);
  const updateMutation = useApiPut<Employee>([['employees']]);
  const deleteMutation = useApiDelete([['employees']]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeForm>({ resolver: zodResolver(employeeSchema) });

  const openCreate = () => {
    setEditingId(null);
    reset({ name: '', email: '', phone: '', position: '', hireDate: '', salary: 0, status: 'Active' });
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    reset({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      departmentId: emp.departmentId || '',
      position: emp.position,
      hireDate: new Date(emp.hireDate).toISOString().split('T')[0],
      salary: emp.salary,
      status: emp.status as any,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: EmployeeForm) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ endpoint: `/employees/${editingId}`, data });
        addToast('Employee updated', 'success');
      } else {
        await createMutation.mutateAsync({ endpoint: '/employees', data });
        addToast('Employee created', 'success');
      }
      setDialogOpen(false);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(`/employees/${deleteId}`);
      addToast('Employee deleted', 'success');
      setDeleteId(null);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const filtered = employees?.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const statusVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'success' as const;
      case 'Inactive': return 'warning' as const;
      case 'Terminated': return 'destructive' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('Employees')}</h1>
          <p className="text-muted-foreground">{t('Manage your workforce')}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> {t('Add Employee')}
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          className="ps-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!filtered || filtered.length === 0 ? (
        <EmptyState icon={Users} title={t('No employees')} description={t('Add your first employee.')} />
      ) : (
        <>
          <div className="grid gap-4 sm:hidden">
            {filtered.map((emp, i) => (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-sm text-muted-foreground">{emp.position}</p>
                        <p className="text-sm text-muted-foreground">{emp.email}</p>
                      </div>
                      <Badge variant={statusVariant(emp.status)}>{emp.status}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatCurrency(emp.salary)}</span>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(emp.id)}>
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

          <div className="hidden sm:block rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Name')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Email')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Department')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Position')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Salary')}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t('Status')}</th>
                  {canManage && <th className="px-4 py-3 text-end text-sm font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium">{emp.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{emp.email}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{emp.department?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm">{emp.position}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(emp.salary)}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusVariant(emp.status)}>{emp.status}</Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(emp.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingId ? t('Edit Employee') : t('Add Employee')}</DialogTitle>
          <DialogDescription>Fill in the details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('Name')}</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('Email')}</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('Phone')}</Label>
              <Input {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label>{t('Department')}</Label>
              <Select {...register('departmentId')}>
                <option value="">No department</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('Position')}</Label>
              <Input {...register('position')} />
              {errors.position && <p className="text-xs text-destructive">{errors.position.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('Hire Date')}</Label>
              <Input type="date" {...register('hireDate')} />
              {errors.hireDate && <p className="text-xs text-destructive">{errors.hireDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('Salary')}</Label>
              <Input type="number" step="0.01" {...register('salary')} />
              {errors.salary && <p className="text-xs text-destructive">{errors.salary.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('Status')}</Label>
              <Select {...register('status')}>
                <option value="Active">{t('Active')}</option>
                <option value="Inactive">{t('Inactive')}</option>
                <option value="Terminated">{t('Terminated')}</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogHeader>
          <DialogTitle>{t('Delete Employee')}</DialogTitle>
          <DialogDescription>{t('Are you sure? This action cannot be undone.')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={confirmDelete}>{t('Delete')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
