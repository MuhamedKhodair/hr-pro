'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Users, Download, Upload, Pencil, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportActions } from '@/components/reports/export-actions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { isAdminOrHr } from '@/lib/auth';
import { TableSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/tables/data-table';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/tables/table';
import { useTranslation } from '@/lib/i18n';
import { formatDateTime, formatDate } from '@/lib/utils';
import { parseCsv, stripBom } from '@/lib/csv';
import { useForm } from 'react-hook-form';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  overtimeHrs: number;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  employee: { id: string; name: string; email: string; department: { name: string } | null };
}

interface Employee {
  id: string;
  name: string;
}

export default function AttendancePage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const isManager = isAdminOrHr();

  const today = new Date().toISOString().split('T')[0];
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const rangeEndpoint = isManager
    ? `/attendance/range?start=${start}&end=${end}${employeeFilter ? `&employeeId=${employeeFilter}` : ''}`
    : '/attendance/today';

  const { data: records, isLoading, error, refetch } = useApiGet<AttendanceRecord[]>(['attendance', start, end, employeeFilter], rangeEndpoint);
  const { data: employees } = useApiGet<Employee[]>(['employees-min'], isManager ? '/employees' : null);

  const checkInMutation = useApiPost([['attendance', start, end, employeeFilter]]);
  const checkOutMutation = useApiPost([['attendance', start, end, employeeFilter]]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      employeeId: '',
      date: today,
      checkIn: '',
      checkOut: '',
      status: 'Present',
      overtimeHrs: '0',
      notes: '',
    },
  });

  const handleCheckIn = async (employeeId: string) => {
    try {
      await checkInMutation.mutateAsync({ endpoint: '/attendance/check-in', data: { employeeId } });
      addToast(t('Check-in recorded'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleCheckOut = async (employeeId: string) => {
    try {
      await checkOutMutation.mutateAsync({ endpoint: '/attendance/check-out', data: { employeeId } });
      addToast(t('Check-out recorded'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleManual = async (data: any) => {
    try {
      const payload = {
        employeeId: data.employeeId,
        date: data.date,
        checkIn: data.checkIn || null,
        checkOut: data.checkOut || null,
        status: data.status,
        overtimeHrs: Number(data.overtimeHrs || 0),
        notes: data.notes || undefined,
      };
      const res = await api.post('/attendance/manual', payload);
      if (res.data) addToast(t('Attendance saved'), 'success');
      setManualOpen(false);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      await api.download(`/attendance/export/csv?start=${start}&end=${end}`, `attendance-${start}-to-${end}.csv`);
      addToast(t('Exported to CSV'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      const rows = parseCsv(stripBom(importText));
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const body = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
      const mapped = body.map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => (obj[h] = (r[idx] || '').trim()));
        return {
          employeeEmail: obj['employee email'] || obj.email || '',
          date: obj.date || '',
          checkIn: obj['check in'] || obj.checkin || '',
          checkOut: obj['check out'] || obj.checkout || '',
          status: (obj.status || 'Present') as 'Present' | 'Absent' | 'HalfDay',
          overtimeHrs: obj.overtime ? Number(obj.overtime) : undefined,
          notes: obj.notes || undefined,
        };
      });
      const res = await api.post<{ created: number; updated: number; errors: number; details: { email: string; status: string; message?: string }[] }>(
        '/attendance/bulk-import',
        { rows: mapped },
      );
      const d = res.data!;
      setImportResult(
        `${t('Created')}: ${d.created} · ${t('Updated')}: ${d.updated} · ${t('Errors')}: ${d.errors}\n` +
          d.details.filter((x) => x.status === 'error').map((x) => `${x.email}: ${x.message}`).join('\n'),
      );
      refetch();
      addToast(t('Attendance imported'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!records) return [];
    if (!isManager) return records;
    return employeeFilter ? records.filter((r) => r.employeeId === employeeFilter) : records;
  }, [records, employeeFilter, isManager]);

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const checkedIn = filtered.filter((r) => r.checkIn && !r.checkOut).length;
  const completed = filtered.filter((r) => r.checkIn && r.checkOut).length;
  const totalOvertime = filtered.reduce((sum, r) => sum + (r.overtimeHrs || 0), 0);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'Present': return 'success' as const;
      case 'HalfDay': return 'warning' as const;
      case 'Absent': return 'destructive' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Attendance')}
        description={isManager ? t('Team attendance') : t("Today's attendance")}
        actions={
          isManager && (
            <div className="flex flex-wrap gap-2">
              <ExportActions
                excelPath={`/attendance/export/xlsx?start=${start}&end=${end}`}
                excelFilename={`attendance-${start}-to-${end}.xlsx`}
                printPath={`type=attendance&start=${start}&end=${end}`}
              />
              <Button variant="outline" onClick={handleExportCsv} className="gap-2">
                <Download className="h-4 w-4" /> {t('Export CSV')}
              </Button>
              <Button variant="outline" onClick={() => { setImportOpen(true); setImportResult(null); }} className="gap-2">
                <Upload className="h-4 w-4" /> {t('Import CSV')}
              </Button>
              <Button variant="outline" onClick={() => { reset({ employeeId: '', date: today, checkIn: '', checkOut: '', status: 'Present', overtimeHrs: '0', notes: '' }); setManualOpen(true); }} className="gap-2">
                <Pencil className="h-4 w-4" /> {t('Manual Entry')}
              </Button>
            </div>
          )
        }
      />

      {isManager && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('From')}</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('To')}</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('Employee')}</Label>
            <Select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="w-48">
              <option value="">{t('All employees')}</option>
              {employees?.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('Checked In')}</p>
              <p className="text-xl font-bold">{checkedIn}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('Completed')}</p>
              <p className="text-xl font-bold">{completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Users className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('Overtime (hrs)')}</p>
              <p className="text-xl font-bold">{totalOvertime.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t('No attendance records')} description={t('No records for the selected range.')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Employee')}</TableHead>
              <TableHead>{t('Date')}</TableHead>
              <TableHead>{t('Check In')}</TableHead>
              <TableHead>{t('Check Out')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Overtime')}</TableHead>
              <TableHead>{t('Location')}</TableHead>
              <TableHead className="text-end">{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((record, i) => (
              <motion.tr
                key={record.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <TableCell>
                  <p className="font-medium">{record.employee.name}</p>
                  <p className="text-xs text-muted-foreground">{record.employee.department?.name || ''}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(record.date)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {record.checkIn ? formatDateTime(record.checkIn) : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {record.checkOut ? formatDateTime(record.checkOut) : '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                </TableCell>
                <TableCell>{record.overtimeHrs > 0 ? `${record.overtimeHrs}h` : '-'}</TableCell>
                <TableCell>
                  {record.latitude != null && record.longitude != null ? (
                    <a
                      href={`https://maps.google.com/?q=${record.latitude},${record.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      aria-label={t('Open in Maps')}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-end">
                  {isManager ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        reset({
                          employeeId: record.employeeId,
                          date: formatDate(record.date),
                          checkIn: record.checkIn ? new Date(record.checkIn).toTimeString().slice(0, 5) : '',
                          checkOut: record.checkOut ? new Date(record.checkOut).toTimeString().slice(0, 5) : '',
                          status: record.status,
                          overtimeHrs: String(record.overtimeHrs || 0),
                          notes: record.notes || '',
                        });
                        setManualOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : !record.checkIn ? (
                    <Button size="sm" onClick={() => handleCheckIn(record.employeeId)} disabled={checkInMutation.isPending}>
                      {t('Check In')}
                    </Button>
                  ) : !record.checkOut ? (
                    <Button size="sm" variant="outline" onClick={() => handleCheckOut(record.employeeId)} disabled={checkOutMutation.isPending}>
                      {t('Check Out')}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('Done')}</span>
                  )}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogHeader>
          <DialogTitle>{t('Manual Attendance Entry')}</DialogTitle>
          <DialogDescription>{t('Record or correct an attendance entry.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleManual)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('Employee')}</Label>
            <Select {...register('employeeId')}>
              <option value="">{t('Select employee')}</option>
              {employees?.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
            {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t('Date')}</Label>
            <Input type="date" {...register('date')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('Check In')}</Label>
              <Input type="time" {...register('checkIn')} />
            </div>
            <div className="space-y-2">
              <Label>{t('Check Out')}</Label>
              <Input type="time" {...register('checkOut')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('Status')}</Label>
              <Select {...register('status')}>
                <option value="Present">{t('Present')}</option>
                <option value="HalfDay">{t('HalfDay')}</option>
                <option value="Absent">{t('Absent')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('Overtime (hrs)')}</Label>
              <Input type="number" step="0.5" min="0" {...register('overtimeHrs')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('Notes')}</Label>
            <Input {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit">{t('Save')}</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) { setImportOpen(false); setImportResult(null); setImportText(''); } }}>
        <DialogHeader>
          <DialogTitle>{t('Import Attendance (CSV)')}</DialogTitle>
          <DialogDescription>
            {t('Headers: employee email, date, check in, check out, status, overtime, notes')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setImportText(await file.text());
            }}
          />
          {importText && (
            <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">{importText.slice(0, 1500)}</pre>
          )}
          {importResult && (
            <pre className="whitespace-pre-wrap rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">{importResult}</pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>{t('Close')}</Button>
            <Button onClick={handleImport} disabled={!importText || importing}>
              {importing ? t('Importing...') : t('Import')}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
