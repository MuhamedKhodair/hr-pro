'use client';

import { useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Building2,
  Users,
  Clock,
  FolderOpen,
  Wallet,
  Mail,
  Phone,
  Download,
  FileText,
  Loader2,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, ErrorState } from '@/components/tables/data-table';
import { useApiGet } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getUser } from '@/lib/auth';

interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  salary: number;
  hireDate: string;
  birthDate: string | null;
  status: 'Active' | 'Inactive' | 'Terminated';
  department?: { id: string; name: string } | null;
  manager?: { id: string; name: string; position: string } | null;
  shift?: { id: string; name: string; startTime: string; endTime: string } | null;
  directReports: { id: string; name: string; position: string }[];
}

interface EmployeeDocument {
  id: string;
  label: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
}

interface AttendanceRecord {
  status: string;
}

interface LeaveRecord {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  isCancelled: boolean;
}

interface PayrollRecord {
  id: string;
  month: number;
  year: number;
  netSalary: number;
  status: string;
}

const apiPath = (url: string) => url.replace(/^\/api/, '');
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LETTER_TYPES = ['employment', 'salary', 'leave'] as const;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function statusVariant(status: string): 'success' | 'warning' | 'outline' | 'destructive' {
  if (status === 'Active') return 'success';
  if (status === 'Terminated') return 'destructive';
  return 'warning';
}

function leaveStatusVariant(status: string): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'Approved') return 'success';
  if (status === 'Pending') return 'warning';
  return 'destructive';
}

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = getUser()?.role === 'Admin';
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [letterBusy, setLetterBusy] = useState<string | null>(null);
  const [letter, setLetter] = useState<{ label: string; html: string } | null>(null);
  const [letterError, setLetterError] = useState<string | null>(null);
  const letterFrameRef = useRef<HTMLIFrameElement>(null);

  const openLetter = async (type: (typeof LETTER_TYPES)[number], label: string) => {
    setLetterBusy(type);
    setLetterError(null);
    try {
      const res = await fetch(`${API_URL}/letters/${type}/${params.id}`, { credentials: 'include' });
      if (!res.ok) {
        let msg = t('Failed to generate the letter');
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch {
          /* non-JSON body */
        }
        throw new Error(msg);
      }
      setLetter({ label, html: await res.text() });
    } catch (err: any) {
      setLetterError(err.message || t('Failed to generate the letter'));
    } finally {
      setLetterBusy(null);
    }
  };

  const now = useMemo(() => new Date(), []);
  const { data: employee, isLoading, error } = useApiGet<EmployeeProfile>(['employee', params.id], `/employees/${params.id}`);
  const { data: documents } = useApiGet<EmployeeDocument[]>(['employee-docs', params.id], `/uploads/employee-documents/${params.id}`);
  const { data: attendance } = useApiGet<AttendanceRecord[]>(
    ['employee-attendance', params.id],
    `/attendance/monthly/${params.id}/${now.getFullYear()}/${now.getMonth() + 1}`,
  );
  const { data: leaves } = useApiGet<LeaveRecord[]>(['employee-leaves', params.id], `/leaves?employeeId=${params.id}`);
  const { data: payrolls } = useApiGet<PayrollRecord[]>(
    ['employee-payrolls', params.id],
    isAdmin ? `/salary/payroll?employeeId=${params.id}` : null,
  );

  if (isLoading || (!employee && !error)) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !employee) return <ErrorState message={t('Employee not found')} onRetry={() => router.push('/employees')} />;

  const present = attendance?.filter((a) => a.status === 'Present').length ?? 0;
  const absences = attendance?.filter((a) => a.status === 'Absent').length ?? 0;
  const halfDays = attendance?.filter((a) => a.status === 'HalfDay' || a.status === 'Half Day').length ?? 0;
  const initials = employee.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const downloadDoc = async (doc: EmployeeDocument) => {
    setDownloadBusy(true);
    try {
      await api.download(apiPath(doc.url), doc.fileName);
    } catch (err: any) {
      /* toast-less; download errors are rare */
      console.error(err);
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/employees')} className="-ml-2">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t('Back to Employees')}
      </Button>

      <PageHeader
        title={employee.name}
        description={`${employee.position} · ${employee.department?.name || '-'}`}
        actions={
          <Badge variant={statusVariant(employee.status)}>{employee.status}</Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> {t('Profile')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 font-display text-lg font-semibold text-primary">
                {initials}
              </div>
              <div>
                <p className="font-medium leading-tight">{employee.name}</p>
                <p className="text-sm text-muted-foreground">{employee.email}</p>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${employee.email}`} className="hover:text-foreground">{employee.email}</a>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                {employee.phone || '-'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {employee.department?.name || '-'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                {employee.position}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                {t('Manager')}: {employee.manager ? (
                  <button onClick={() => router.push(`/employees/${employee.manager!.id}`)} className="text-primary hover:underline">
                    {employee.manager!.name}
                  </button>
                ) : '-'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {t('Shift')}: {employee.shift ? `${employee.shift.name} (${employee.shift.startTime}–${employee.shift.endTime})` : '-'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {t('Hired')}: {formatDate(employee.hireDate)}
              </div>
              {employee.birthDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {t('Birthday')}: {formatDate(employee.birthDate)}
                </div>
              )}
              {isAdmin && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  {t('Base Salary')}: {formatCurrency(employee.salary)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* This month attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> {t('This Month')}
            </CardTitle>
            <CardDescription>{t('Attendance summary')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="font-display text-2xl font-semibold text-primary">{present}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('Present')}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="font-display text-2xl font-semibold text-amber-600">{halfDays}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('Half Days')}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="font-display text-2xl font-semibold text-destructive">{absences}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('Absences')}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => router.push('/attendance')}>
              {t('Open Attendance')}
            </Button>
          </CardContent>
        </Card>

        {/* Direct reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> {t('Direct Reports')}
            </CardTitle>
            <CardDescription>{t('People who report to this employee')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.directReports.length === 0 && <p className="text-sm text-muted-foreground">{t('None')}</p>}
            {employee.directReports.map((r) => (
              <button
                key={r.id}
                onClick={() => router.push(`/employees/${r.id}`)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-start transition-colors hover:bg-muted/50"
              >
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.position}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" /> {t('Documents')}
            </CardTitle>
            <CardDescription>{t('Contracts, IDs and certificates')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(!documents || documents.length === 0) && <p className="text-sm text-muted-foreground">{t('No documents yet.')}</p>}
            {documents?.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{doc.label}</p>
                  <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => downloadDoc(doc)} disabled={downloadBusy}>
                  <Download className="mr-1.5 h-4 w-4" />
                  {t('Download')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* HR Letters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> {t('HR Letters')}
            </CardTitle>
            <CardDescription>{t('Employment, salary and leave certificates')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {letterError && <p className="text-sm text-destructive">{letterError}</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="outline" onClick={() => openLetter('employment', t('Employment Certificate'))} disabled={!!letterBusy}>
                {letterBusy === 'employment' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Briefcase className="mr-1.5 h-4 w-4" />}
                {t('Employment Certificate')}
              </Button>
              <Button variant="outline" onClick={() => openLetter('salary', t('Salary Certificate'))} disabled={!!letterBusy}>
                {letterBusy === 'salary' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wallet className="mr-1.5 h-4 w-4" />}
                {t('Salary Certificate')}
              </Button>
              <Button variant="outline" onClick={() => openLetter('leave', t('Leave Confirmation'))} disabled={!!letterBusy}>
                {letterBusy === 'leave' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-1.5 h-4 w-4" />}
                {t('Leave Confirmation')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('Letters use company settings and employee records.')}</p>
          </CardContent>
        </Card>

        {/* Recent leaves */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> {t('Recent Leave Requests')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(!leaves || leaves.length === 0) && <p className="text-sm text-muted-foreground">{t('No leave requests.')}</p>}
            {leaves?.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{l.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(l.startDate)} → {formatDate(l.endDate)} · {l.totalDays} {t('Days')}
                  </p>
                </div>
                <Badge variant={l.isCancelled ? 'outline' : leaveStatusVariant(l.status)}>
                  {l.isCancelled ? t('Cancelled') : l.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" /> {t('Payroll History')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!payrolls || payrolls.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('No payslips yet.')}</p>
            ) : (
              <div className="divide-y divide-border">
                {payrolls.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-1 py-2.5">
                    <span className="font-mono text-sm">
                      {MONTHS_SHORT[p.month - 1]} {p.year}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{formatCurrency(p.netSalary)}</span>
                      <Badge variant={p.status === 'PAID' ? 'success' : p.status === 'FINALIZED' ? 'warning' : 'outline'}>
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push('/salary/payroll')}>
              {t('Open Payroll')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!letter} onOpenChange={() => setLetter(null)} className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{letter?.label}</DialogTitle>
          <DialogDescription>{t('Preview the letter below, then print or save it as PDF.')}</DialogDescription>
        </DialogHeader>
        {letter && (
          <iframe
            ref={letterFrameRef}
            title={letter.label}
            srcDoc={letter.html}
            className="h-[70vh] w-full rounded-lg border border-border bg-white"
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setLetter(null)}>{t('Close')}</Button>
          <Button onClick={() => letterFrameRef.current?.contentWindow?.print()} disabled={!letter}>
            <Printer className="mr-1.5 h-4 w-4" /> {t('Print / Save PDF')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
