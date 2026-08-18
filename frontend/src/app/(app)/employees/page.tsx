'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, Users, Pencil, Trash2, Search, Download, Upload, Paperclip, Network, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportActions } from '@/components/reports/export-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut, useApiDelete } from '@/hooks/useApi';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { api } from '@/lib/api';
import { isAdminOrHr } from '@/lib/auth';
import { employeeSchema } from '@/lib/validations';
import { TableSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/tables/data-table';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/tables/table';
import { formatCurrency } from '@/lib/utils';
import { parseCsv, stripBom } from '@/lib/csv';
import Link from 'next/link';
import { z } from 'zod';

interface Department {
  id: string;
  name: string;
  _count: { employees: number };
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  departmentId: string | null;
  position: string;
  hireDate: string;
  birthDate: string | null;
  salary: number;
  status: string;
  reportsToId: string | null;
  department: Department | null;
  manager: { id: string; name: string } | null;
  shift: Shift | null;
  _count?: { directReports: number };
}

interface EmployeeDocument {
  id: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

type EmployeeForm = z.infer<typeof employeeSchema>;

const apiPath = (url: string) => url.replace(/^\/api/, '');
const dateToInput = (d: string | null | undefined) => (d ? new Date(d).toISOString().split('T')[0] : '');

export default function EmployeesPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [docsTarget, setDocsTarget] = useState<Employee | null>(null);
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docLabel, setDocLabel] = useState('');
  const canManage = isAdminOrHr();

  const searchQuery = search.trim();
  const endpoint = canManage
    ? `/employees?page=${page}&pageSize=${pageSize}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
    : null;

  const { data: empResult, isLoading, error, refetch } = usePaginatedQuery<Employee>(['employees', page, searchQuery], endpoint);
  const employees = empResult?.items;
  const pagination = empResult?.pagination;

  const { data: allEmployees } = useApiGet<Employee[]>(['employees-all'], canManage ? '/employees' : null);
  const { data: departments } = useApiGet<Department[]>(['departments'], '/departments');
  const { data: shifts } = useApiGet<Shift[]>(['shifts'], '/shifts');

  const createMutation = useApiPost<Employee>([['employees', page, searchQuery]]);
  const updateMutation = useApiPut<Employee>([['employees', page, searchQuery]]);
  const deleteMutation = useApiDelete([['employees', page, searchQuery]]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeForm>({ resolver: zodResolver(employeeSchema) });

  const openCreate = () => {
    setEditingId(null);
    reset({ name: '', email: '', phone: '', position: '', hireDate: '', birthDate: '', salary: 0, status: 'Active', reportsToId: '', shiftId: '' });
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
      hireDate: dateToInput(emp.hireDate),
      birthDate: dateToInput(emp.birthDate),
      salary: emp.salary,
      status: emp.status as any,
      reportsToId: emp.reportsToId || '',
      shiftId: emp.shift?.id || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: EmployeeForm) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ endpoint: `/employees/${editingId}`, data });
        addToast(t('Employee updated'), 'success');
      } else {
        await createMutation.mutateAsync({ endpoint: '/employees', data });
        addToast(t('Employee created'), 'success');
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
      addToast(t('Employee deleted'), 'success');
      setDeleteId(null);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      await api.download('/employees/export/csv', `employees-${new Date().toISOString().split('T')[0]}.csv`);
      addToast(t('Exported to CSV'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      if (excelFile) {
        const res = await api.upload<{ created: number; skipped: number; errors: number; details: { email: string; status: string; message?: string }[] }>(
          '/uploads/employees/import',
          excelFile,
        );
        const d = res.data!;
        setImportResult(
          `${t('Created')}: ${d.created} · ${t('Skipped')}: ${d.skipped} · ${t('Errors')}: ${d.errors}\n` +
            d.details.filter((x) => x.status === 'error').map((x) => `${x.email}: ${x.message}`).join('\n'),
        );
        refetch();
        addToast(`${d.created} ${t('employees created')}`, 'success');
        setExcelFile(null);
        return;
      }
      const rows = parseCsv(stripBom(importText));
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const bodyRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
      const mapped = bodyRows.map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => (obj[h] = (r[idx] || '').trim()));
        return {
          name: obj.name || '',
          email: obj.email || '',
          phone: obj.phone || '',
          department: obj.department || '',
          position: obj.position || '',
          hireDate: obj['hire date'] || obj.hiredate || '',
          salary: Number(obj.salary || 0),
          managerEmail: obj['manager email'] || obj.manager || '',
        };
      });
      const res = await api.post<{ created: number; skipped: number; errors: number; details: { email: string; status: string; message?: string }[] }>(
        '/employees/bulk-import',
        { rows: mapped },
      );
      const d = res.data!;
      setImportResult(
        `${t('Created')}: ${d.created} · ${t('Skipped')}: ${d.skipped} · ${t('Errors')}: ${d.errors}\n` +
          d.details.filter((x) => x.status === 'error').map((x) => `${x.email}: ${x.message}`).join('\n'),
      );
      refetch();
      addToast(`${d.created} ${t('employees created')}`, 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const openDocs = async (emp: Employee) => {
    setDocsTarget(emp);
    setDocLabel('');
    try {
      const res = await api.get<EmployeeDocument[]>(`/uploads/employee-documents/${emp.id}`);
      setDocs(res.data || []);
    } catch {
      setDocs([]);
    }
  };

  const handleDocUpload = async (file: File | undefined) => {
    if (!docsTarget || !file) return;
    setUploadingDoc(true);
    try {
      const res = await api.upload<EmployeeDocument>(`/uploads/employee-document/${docsTarget.id}`, file, { label: docLabel || file.name });
      setDocs((prev) => [res.data!, ...prev]);
      addToast(t('Document uploaded'), 'success');
      setDocLabel('');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocDelete = async (id: string) => {
    try {
      await api.delete(`/uploads/employee-document/${id}`);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      addToast(t('Document deleted'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const openDoc = async (doc: EmployeeDocument) => {
    try {
      await api.download(apiPath(doc.url), doc.fileName);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

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
      <PageHeader
        title={t('Employees')}
        description={t('Manage your workforce')}
        actions={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <Link href="/employees/org-chart">
                <Button variant="outline" className="gap-2">
                  <Network className="h-4 w-4" /> {t('Org Chart')}
                </Button>
              </Link>
              <Button variant="outline" onClick={handleExportCsv} className="gap-2">
                <Download className="h-4 w-4" /> {t('Export CSV')}
              </Button>
              <ExportActions
                excelPath="/employees/export/xlsx"
                excelFilename={`employees-${new Date().toISOString().split('T')[0]}.xlsx`}
                printPath="type=employees"
              />
              <Button variant="outline" onClick={() => { setImportOpen(true); setImportResult(null); }} className="gap-2">
                <Upload className="h-4 w-4" /> {t('Import')}
              </Button>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" /> {t('Add Employee')}
              </Button>
            </div>
          )
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('Search employees...')}
          className="ps-10"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {!employees || employees.length === 0 ? (
        <EmptyState icon={Users} title={t('No employees')} description={t('Add your first employee.')} />
      ) : (
        <>
          <div className="grid gap-4 sm:hidden">
            {employees.map((emp, i) => (
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
                          <Button variant="ghost" size="icon" onClick={() => openDocs(emp)} title={t('Documents')}>
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Link href={`/employees/${emp.id}`}>
                            <Button variant="ghost" size="icon" title={t('View Profile')}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
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

          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Name')}</TableHead>
                  <TableHead>{t('Department')}</TableHead>
                  <TableHead>{t('Position')}</TableHead>
                  <TableHead>{t('Manager')}</TableHead>
                  <TableHead>{t('Shift')}</TableHead>
                  <TableHead>{t('Salary')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  {canManage && <TableHead className="text-end">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp, i) => (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <TableCell>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.department?.name || '-'}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.manager?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {emp.shift ? `${emp.shift.name} (${emp.shift.startTime}-${emp.shift.endTime})` : '-'}
                    </TableCell>
                    <TableCell>{formatCurrency(emp.salary)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(emp.status)}>{emp.status}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-end">
                        <Button variant="ghost" size="icon" onClick={() => openDocs(emp)} title={t('Documents')}>
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Link href={`/employees/${emp.id}`}>
                          <Button variant="ghost" size="icon" title={t('View Profile')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(emp.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {pagination.total} {t('employees')} · {t('Page')} {pagination.page} / {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {t('Previous')}
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                  {t('Next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingId ? t('Edit Employee') : t('Add Employee')}</DialogTitle>
          <DialogDescription>{t('Fill in the details below.')}</DialogDescription>
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
                <option value="">{t('No department')}</option>
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
              <Label>{t('Birth Date')}</Label>
              <Input type="date" {...register('birthDate')} />
            </div>
            <div className="space-y-2">
              <Label>{t('Salary')}</Label>
              <Input type="number" step="0.01" {...register('salary')} />
              {errors.salary && <p className="text-xs text-destructive">{errors.salary.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('Manager')}</Label>
              <Select {...register('reportsToId')}>
                <option value="">{t('No manager')}</option>
                {allEmployees
                  ?.filter((e) => e.id !== editingId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('Shift')}</Label>
              <Select {...register('shiftId')}>
                <option value="">{t('No shift')}</option>
                {shifts?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>
                ))}
              </Select>
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
              {editingId ? t('Update') : t('Create')}
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

      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) { setImportOpen(false); setImportResult(null); setImportText(''); setExcelFile(null); } }}>
        <DialogHeader>
          <DialogTitle>{t('Import Employees')}</DialogTitle>
          <DialogDescription>
            {t('Excel file (.xlsx or .xls)')} · {t('Headers: name, email, phone, department, position, hire date, salary, manager email')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('Import from Excel')}</Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setExcelFile(file);
                  setImportText('');
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={async () => {
                  try {
                    await api.download('/employees/import/template', 'employee-import-template.xlsx');
                  } catch (err: any) {
                    addToast(err.message, 'error');
                  }
                }}
              >
                <Download className="h-3.5 w-3.5" /> {t('Download template')}
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <p className="relative mx-auto w-fit bg-background px-2 text-xs uppercase tracking-wider text-muted-foreground">
              {t('or')}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t('Paste CSV data')}</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setExcelFile(null);
                  setImportText(await file.text());
                }
              }}
            />
          </div>
          {importText && (
            <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
              {importText.slice(0, 1500)}
            </pre>
          )}
          {importResult && (
            <pre className="whitespace-pre-wrap rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              {importResult}
            </pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>{t('Close')}</Button>
            <Button onClick={handleImport} disabled={(!importText && !excelFile) || importing}>
              {importing ? t('Importing...') : t('Import')}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      <Dialog open={!!docsTarget} onOpenChange={(o) => { if (!o) setDocsTarget(null); }}>
        <DialogHeader>
          <DialogTitle>{t('Documents')} — {docsTarget?.name}</DialogTitle>
          <DialogDescription>{t('Upload contracts, IDs and other files.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>{t('Label')}</Label>
              <Input value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder={t('e.g. Contract, ID, Certificate')} />
            </div>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploadingDoc}
              onChange={(e) => handleDocUpload(e.target.files?.[0])}
              className="max-w-[200px]"
            />
          </div>
          <div className="space-y-2">
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('No documents yet.')}</p>
            ) : (
              docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.label}</p>
                      <p className="text-xs text-muted-foreground">{(doc.sizeBytes / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openDoc(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDocDelete(doc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
