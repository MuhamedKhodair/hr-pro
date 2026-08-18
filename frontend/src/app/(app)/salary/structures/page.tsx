'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useRequireRole } from '@/hooks/useRequireRole';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, Calculator, Pencil, Gift, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiDelete } from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/tables/data-table';
import { z } from 'zod';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: { name: string } | null;
}

interface SalaryStructure {
  id: string;
  employeeId: string;
  baseSalary: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  employee: { id: string; name: string; email: string; department: { name: string } | null };
}

interface SalaryComponent {
  id: string;
  employeeId: string;
  type: string;
  label: string;
  amount: number;
  isRecurring: boolean;
  endedAt: string | null;
  employee?: { id: string; name: string };
}

const componentSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(['BONUS', 'INCENTIVE', 'DEDUCTION', 'ALLOWANCE']),
  label: z.string().min(1, 'Label is required'),
  amount: z.coerce.number(),
  isRecurring: z.boolean().optional(),
});

type ComponentForm = z.infer<typeof componentSchema>;

const typeOptions = [
  { value: 'BONUS', label: 'Bonus' },
  { value: 'INCENTIVE', label: 'Incentive' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'ALLOWANCE', label: 'Allowance' },
];

export default function SalaryStructuresPage() {
  useRequireRole(['Admin']);
  const { addToast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [salaryDialog, setSalaryDialog] = useState(false);
  const [compDialog, setCompDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [deleteCompId, setDeleteCompId] = useState<string | null>(null);

  const { data: structures, isLoading, error, refetch } = useApiGet<SalaryStructure[]>(['salary-structures'], '/salary/salary-structure');
  const { data: employees } = useApiGet<Employee[]>(['salary-employees'], '/salary/employees');
  const { data: allComponents } = useApiGet<SalaryComponent[]>(['all-salary-components'], '/salary/salary-components');

  const componentsByEmployee = allComponents?.reduce<Record<string, SalaryComponent[]>>((acc, c) => {
    if (!acc[c.employeeId]) acc[c.employeeId] = [];
    acc[c.employeeId].push(c);
    return acc;
  }, {}) ?? {};

  const createStructure = useApiPost<SalaryStructure>([['salary-structures']]);
  const createComponent = useApiPost<SalaryComponent>();
  const deleteComponent = useApiDelete();

  const structureForm = useForm({ defaultValues: { employeeId: '', baseSalary: 0, effectiveFrom: '' } });
  const componentForm = useForm<ComponentForm>({
    resolver: zodResolver(componentSchema),
    defaultValues: { employeeId: '', type: 'BONUS', label: '', amount: 0, isRecurring: false },
  });

  const onSubmitStructure = async (data: any) => {
    try {
      await createStructure.mutateAsync({ endpoint: '/salary/salary-structure', data });
      addToast('Salary structure updated', 'success');
      setSalaryDialog(false);
      structureForm.reset();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const onSubmitComponent = async (data: ComponentForm) => {
    try {
      setSelectedEmployee(data.employeeId);
      await createComponent.mutateAsync({ endpoint: '/salary/salary-components', data });
      addToast('Component added', 'success');
      setCompDialog(false);
      componentForm.reset();
      queryClient.invalidateQueries({ queryKey: ['all-salary-components'] });
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const confirmDeleteComponent = async () => {
    if (!deleteCompId) return;
    try {
      setSelectedEmployee(deleteCompId);
      await deleteComponent.mutateAsync(`/salary/salary-components/${deleteCompId}`);
      addToast('Component removed', 'success');
      setDeleteCompId(null);
      queryClient.invalidateQueries({ queryKey: ['all-salary-components'] });
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const openSalaryDialog = (emplId?: string, currentSalary?: number) => {
    structureForm.reset({ employeeId: emplId || '', baseSalary: currentSalary || 0, effectiveFrom: new Date().toISOString().split('T')[0] });
    setSalaryDialog(true);
  };

  const openCompDialog = (emplId: string) => {
    setSelectedEmployee(emplId);
    componentForm.reset({ employeeId: emplId, type: 'BONUS', label: '', amount: 0, isRecurring: false });
    setCompDialog(true);
  };

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
<h1 className="text-2xl font-bold">{t('Salary Structures')}</h1>
           <p className="text-muted-foreground">{t('Manage base salaries and incentive components')}</p>
        </div>
        <Button onClick={() => openSalaryDialog()} className="gap-2">
          <Plus className="h-4 w-4" /> {t('New Structure')}
        </Button>
      </div>

      {!structures || structures.length === 0 ? (
        <EmptyState icon={Calculator} title={t('No salary structures')} description={t('Create the first salary structure.')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {structures.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{s.employee.name}</h3>
                      <p className="text-xs text-muted-foreground">{s.employee.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.employee.department?.name || 'No dept'} &middot; Since {formatDate(s.effectiveFrom)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(s.baseSalary)}</p>
                      <p className="text-xs text-muted-foreground">{s.currency}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openCompDialog(s.employeeId)}>
                      <Gift className="h-3 w-3 me-1" /> {t('Add Component')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openSalaryDialog(s.employeeId, s.baseSalary)}>
                      <Pencil className="h-3 w-3 me-1" /> {t('Update')}
                    </Button>
                  </div>

                  {componentsByEmployee[s.employeeId]?.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t('Components')} ({componentsByEmployee[s.employeeId].length})
                      </p>
                      {componentsByEmployee[s.employeeId].map((c) => (
                        <div key={c.id} className="flex items-center justify-between py-1 text-xs">
                          <span>
                            <span className={`font-medium ${c.type === 'DEDUCTION' ? 'text-destructive' : 'text-emerald-600'}`}>
                              {c.type}
                            </span>
                            {': '}{c.label}{c.isRecurring ? ' (recurring)' : ''}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {c.type === 'DEDUCTION' ? '-' : '+'}{formatCurrency(Math.abs(c.amount))}
                            </span>
                            <button onClick={() => setDeleteCompId(c.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={salaryDialog} onOpenChange={setSalaryDialog}>
        <DialogHeader>
<DialogTitle>{t('Salary Structure')}</DialogTitle>
           <DialogDescription>{t('Set or update base salary (previous version is preserved).')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={structureForm.handleSubmit(onSubmitStructure)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('Employee')}</Label>
            <Select {...structureForm.register('employeeId')}>
              <option value="">Select employee</option>
              {employees?.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Base Salary')} (USD)</Label>
            <Input type="number" step="0.01" {...structureForm.register('baseSalary', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label>{t('Effective From')}</Label>
            <Input type="date" {...structureForm.register('effectiveFrom')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSalaryDialog(false)}>{t('Cancel')}</Button>
            <Button type="submit">{t('Save')}</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={compDialog} onOpenChange={setCompDialog}>
        <DialogHeader>
<DialogTitle>{t('Salary Component')}</DialogTitle>
           <DialogDescription>{t('Add incentive, bonus, deduction, or allowance.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={componentForm.handleSubmit(onSubmitComponent)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('Type')}</Label>
            <Select {...componentForm.register('type')}>
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Label')}</Label>
            <Input {...componentForm.register('label')} placeholder="e.g. Transport Allowance" />
            {componentForm.formState.errors.label && <p className="text-xs text-destructive">{componentForm.formState.errors.label.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t('Amount')}</Label>
            <Input type="number" step="0.01" {...componentForm.register('amount', { valueAsNumber: true })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isRecurring" {...componentForm.register('isRecurring')} className="rounded border-input" />
            <Label htmlFor="isRecurring">{t('Recurring (auto-applies to future payrolls)')}</Label>
          </div>
          <input type="hidden" {...componentForm.register('employeeId')} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompDialog(false)}>{t('Cancel')}</Button>
            <Button type="submit">{t('Add Component')}</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={!!deleteCompId} onOpenChange={() => setDeleteCompId(null)}>
        <DialogHeader>
<DialogTitle>{t('Remove Component')}</DialogTitle>
           <DialogDescription>{t('This will soft-delete the component (end its effect).')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteCompId(null)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={confirmDeleteComponent}>{t('Delete')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

