'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { UserCircle2, Phone, Download, Briefcase, CalendarDays, Wallet, FolderOpen, Building2, Network, KeyRound, Loader2, ShieldCheck, Copy, Check, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPut } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';

interface EmployeeMe {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
  hireDate: string;
  birthDate: string | null;
  department?: { id: string; name: string } | null;
  manager?: { id: string; name: string } | null;
  shift?: { id: string; name: string; startTime: string; endTime: string } | null;
  documents: { id: string; label: string; fileName: string; mimeType: string; sizeBytes: number; uploadedAt: string; url: string }[];
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

interface PayrollMine {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  totalDeductions: number;
  totalIncentives: number;
  totalBonuses: number;
  netSalary: number;
  status: string;
}

interface PayrollDetail extends PayrollMine {
  adjustment: number;
  adjustmentReason: string | null;
  generatedAt: string;
  finalizedAt: string | null;
  employee: { id: string; name: string; email: string; department: { name: string } | null };
  components: { id: string; type: string; label: string; amount: number }[];
}

interface AttendanceRecord {
  status: string;
}

const apiPath = (url: string) => url.replace(/^\/api/, '');

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MePage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const mustChange = getUser()?.mustChangePassword === true;
  const [phoneDraft, setPhoneDraft] = useState('');
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(getUser()?.twoFactorEnabled === true);

  const now = new Date();
  const { data: me, isLoading } = useApiGet<EmployeeMe>(['me'], '/employees/me');
  const { data: balances } = useApiGet<BalancesResponse>(
    ['me-balances'],
    me ? `/leaves/balances?employeeId=${me.id}` : null,
  );
  const { data: attendance } = useApiGet<AttendanceRecord[]>(
    ['me-attendance', String(now.getFullYear()), String(now.getMonth() + 1)],
    me ? `/attendance/monthly/${me.id}/${now.getFullYear()}/${now.getMonth() + 1}` : null,
  );
  const { data: payrolls } = useApiGet<PayrollMine[]>(['me-payrolls'], '/salary/payroll/mine');
  const [payslip, setPayslip] = useState<PayrollMine | null>(null);
  const { data: payslipDetail, isFetching: payslipLoading } = useApiGet<PayrollDetail>(
    ['me-payslip', payslip?.id ?? ''],
    payslip ? `/salary/payroll/mine/${payslip.id}` : null,
  );

  const updateMe = useApiPut<EmployeeMe>([['me']]);

  const present = attendance?.filter((a) => a.status === 'Present').length ?? 0;
  const halfDays = attendance?.filter((a) => a.status === 'HalfDay' || a.status === 'Half Day').length ?? 0;
  const absences = attendance?.filter((a) => a.status === 'Absent').length ?? 0;

  const savePhone = async () => {
    if (!phoneDraft) return;
    try {
      await updateMe.mutateAsync({ endpoint: '/employees/me', data: { phone: phoneDraft } });
      addToast(t('Profile updated'), 'success');
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    }
  };

  const openDoc = async (doc: EmployeeMe['documents'][number]) => {
    try {
      await api.download(apiPath(doc.url), doc.fileName);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const savePassword = async () => {
    if (pwForm.next.length < 6) {
      addToast(t('New password must be at least 6 characters.'), 'error');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      addToast(t('Passwords do not match.'), 'error');
      return;
    }
    setChangingPassword(true);
    try {
      await api.put('/auth/me/password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      addToast(t('Password updated'), 'success');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const startTwoFactor = async () => {
    setTwoFactorBusy(true);
    try {
      const res = await api.get<{ secret: string; qr: string }>('/auth/2fa/setup');
      if (res.data) setTwoFactorSetup(res.data);
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const enableTwoFactor = async () => {
    if (!twoFactorCode) return;
    setTwoFactorBusy(true);
    try {
      const res = await api.post<{ backupCodes: string[] }>('/auth/2fa/enable', { code: twoFactorCode });
      setBackupCodes(res.data?.backupCodes || []);
      setTwoFactorEnabled(true);
      setTwoFactorCode('');
      const user = getUser();
      if (user) {
        user.twoFactorEnabled = true;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!twoFactorCode) return;
    setTwoFactorBusy(true);
    try {
      await api.post('/auth/2fa/disable', { code: twoFactorCode });
      setTwoFactorEnabled(false);
      setTwoFactorSetup(null);
      setBackupCodes(null);
      setTwoFactorCode('');
      const user = getUser();
      if (user) {
        user.twoFactorEnabled = false;
        localStorage.setItem('user', JSON.stringify(user));
      }
      addToast(t('Two-factor authentication disabled'), 'success');
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const copyBackupCodes = async () => {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (isLoading || !me) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <UserCircle2 className="h-6 w-6 animate-pulse" />
      </div>
    );
  }

  const initials = me.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('My Profile')}</h1>
        <p className="text-muted-foreground">{t('Your personal information, leave balances and payslips')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle2 className="h-5 w-5" /> {t('Personal Information')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-[0_1px_3px_color-mix(in_srgb,var(--primary)_50%,transparent)]">
                {initials}
              </div>
              <div>
                <p className="text-lg font-semibold">{me.name}</p>
                <p className="text-sm text-muted-foreground">{me.position}</p>
                <div className="mt-1.5 flex gap-2">
                  {me.department && <Badge variant="secondary">{me.department.name}</Badge>}
                  <Badge variant={me.status === 'Active' ? 'success' : 'outline'}>{t(me.status)}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t('Email')}</Label>
                <p className="mt-1 text-sm font-medium">{me.email}</p>
              </div>
              <div>
                <Label>{t('Phone')}</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    defaultValue={me.phone || ''}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder={t('Add phone number')}
                  />
                  <Button type="button" variant="outline" onClick={savePhone} disabled={updateMe.isPending}>
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>{t('Hire Date')}</Label>
                <p className="mt-1 text-sm font-medium">{formatDate(me.hireDate)}</p>
              </div>
              <div>
                <Label>{t('Birth Date')}</Label>
                <p className="mt-1 text-sm font-medium">{me.birthDate ? formatDate(me.birthDate) : '—'}</p>
              </div>
              <div>
                <Label>{t('Manager')}</Label>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <Network className="h-4 w-4 text-muted-foreground" /> {me.manager?.name || '—'}
                </p>
              </div>
              <div>
                <Label>{t('Shift')}</Label>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {me.shift ? `${me.shift.name} (${me.shift.startTime} – ${me.shift.endTime})` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" /> {t('Leave Balances')}
              <span className="text-xs font-normal text-muted-foreground">{balances?.year}</span>
            </CardTitle>
            <CardDescription>{t('Remaining days for the current year')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {balances?.balances.map((b) => {
              const pct = b.entitlement > 0 ? Math.min(100, (b.used / b.entitlement) * 100) : 0;
              return (
                <div key={b.type}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-sm font-medium">{t(b.type)}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {b.used} / {b.entitlement} {t('days')}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--primary), var(--primary))' }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('Remaining')}: <span className="font-semibold text-foreground">{b.remaining}</span>
                  </p>
                </div>
              );
            })}
            {balances && balances.pendingRequests > 0 && (
              <Badge variant="warning">{balances.pendingRequests} {t('pending requests')}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> {t('This Month')}
            </CardTitle>
            <CardDescription>
              {MONTHS_SHORT[now.getMonth()]} {now.getFullYear()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950">
              <span className="text-sm">{t('Present')}</span>
              <span className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">{present}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-950">
              <span className="text-sm">{t('Half Days')}</span>
              <span className="font-mono text-lg font-bold text-amber-700 dark:text-amber-400">{halfDays}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950">
              <span className="text-sm">{t('Absences')}</span>
              <span className="font-mono text-lg font-bold text-red-700 dark:text-red-400">{absences}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" /> {t('My Documents')}
            </CardTitle>
            <CardDescription>{t('Files uploaded by HR')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {me.documents.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('No documents yet.')}</p>
            )}
            {me.documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => openDoc(doc)}
                className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-start transition-colors hover:bg-muted"
              >
                <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{doc.label}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" /> {t('Payslips')}
            </CardTitle>
            <CardDescription>{t('Your salary records')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(!payrolls || payrolls.length === 0) && (
              <p className="text-sm text-muted-foreground">{t('No payslips yet.')}</p>
            )}
            {payrolls?.map((p) => (
              <button
                key={p.id}
                onClick={() => setPayslip(p)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">
                    {MONTHS_SHORT[p.month - 1]} {p.year}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-end">
                    <p className="font-mono text-sm font-semibold">{formatCurrency(p.netSalary)}</p>
                    <Badge variant={p.status === 'PAID' ? 'success' : p.status === 'FINALIZED' ? 'warning' : 'outline'}>
                      {t(p.status)}
                    </Badge>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Dialog open={!!payslip} onOpenChange={(o) => !o && setPayslip(null)}>
          <DialogHeader className="print:hidden">
            <DialogTitle>{t('Payslip')}</DialogTitle>
            <DialogDescription>
              {payslip && `${MONTHS_SHORT[payslip.month - 1]} ${payslip.year}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {payslipLoading || !payslipDetail ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-4 print:hidden">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('Employee')}</p>
                    <p className="font-medium">{payslipDetail.employee.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('Username')}</p>
                    <p className="font-medium">{payslipDetail.employee.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('Department')}</p>
                    <p className="font-medium">{payslipDetail.employee.department?.name || t('None')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('Pay Period')}</p>
                    <p className="font-medium">{MONTHS_SHORT[payslipDetail.month - 1]} {payslipDetail.year}</p>
                  </div>
                </div>

                <div className="divide-y rounded-lg border print:border-0">
                  <div className="flex items-center justify-between bg-muted/20 p-4 print:hidden">
                    <span className="font-semibold">{t('Description')}</span>
                    <span className="font-semibold">{t('Amount')}</span>
                  </div>
                  <div className="hidden print:flex items-center justify-between p-4 bg-muted/20">
                    <span className="font-semibold">{t('Payslip')} — {MONTHS_SHORT[payslipDetail.month - 1]} {payslipDetail.year}</span>
                    <span className="font-semibold">{payslipDetail.employee.name}</span>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <span>{t('Base Salary')}</span>
                    <span className="font-mono">{formatCurrency(payslipDetail.baseSalary)}</span>
                  </div>
                  {payslipDetail.components.filter((c) => c.type !== 'DEDUCTION').map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-4 text-emerald-700">
                      <span className="text-sm">{c.label} <span className="text-xs text-muted-foreground">({c.type})</span></span>
                      <span className="font-mono text-sm">+{formatCurrency(Math.abs(c.amount))}</span>
                    </div>
                  ))}
                  {payslipDetail.components.filter((c) => c.type === 'DEDUCTION').map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-4 text-destructive">
                      <span className="text-sm">{c.label} <span className="text-xs text-muted-foreground">({c.type})</span></span>
                      <span className="font-mono text-sm">-{formatCurrency(Math.abs(c.amount))}</span>
                    </div>
                  ))}
                  {payslipDetail.totalDeductions > 0 && (
                    <div className="flex items-center justify-between p-4 text-destructive">
                      <span className="text-sm">{t('Attendance Deductions')}</span>
                      <span className="font-mono text-sm">-{formatCurrency(payslipDetail.totalDeductions)}</span>
                    </div>
                  )}
                  {payslipDetail.adjustment !== 0 && (
                    <div className="flex items-center justify-between p-4">
                      <span className="text-sm">{t('Manual Adjustment')}{payslipDetail.adjustmentReason ? ` (${payslipDetail.adjustmentReason})` : ''}</span>
                      <span className="font-mono text-sm">{payslipDetail.adjustment > 0 ? '+' : ''}{formatCurrency(payslipDetail.adjustment)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-primary/5 p-4 text-lg font-bold">
                    <span>{t('Net Salary')}</span>
                    <span className="font-mono">{formatCurrency(payslipDetail.netSalary)}</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground print:hidden">
                  <p>{t('Generated')}: {formatDate(payslipDetail.generatedAt)}</p>
                  {payslipDetail.finalizedAt && <p>{t('Finalized')}: {formatDate(payslipDetail.finalizedAt)}</p>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 me-1" /> {t('Print / Save PDF')}
            </Button>
            <Button onClick={() => setPayslip(null)}>{t('Close')}</Button>
          </DialogFooter>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> {t('Security')}
            </CardTitle>
            <CardDescription>{t('Update your sign-in password')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mustChange && (
              <Badge variant="warning" className="mb-1">{t('You must set a new password before continuing.')}</Badge>
            )}
            <div className="space-y-2">
              <Label>{t('Current Password')}</Label>
              <Input
                type="password"
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('New Password')}</Label>
              <Input
                type="password"
                value={pwForm.next}
                onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('Confirm New Password')}</Label>
              <Input
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <Button className="w-full" onClick={savePassword} disabled={changingPassword}>
              {changingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('Change Password')}
            </Button>

            <div className="my-4 h-px bg-border" />

            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{t('Two-factor authentication')}</span>
              <Badge variant={twoFactorEnabled ? 'success' : 'outline'}>
                {twoFactorEnabled ? t('Enabled') : t('Disabled')}
              </Badge>
            </div>

            {backupCodes && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {t('Save these backup codes. They can only be viewed once.')}
                </p>
                <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                  {backupCodes.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={copyBackupCodes}>
                  {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copied ? t('Copied!') : t('Copy backup codes')}
                </Button>
              </div>
            )}

            {!twoFactorEnabled && !twoFactorSetup && (
              <Button variant="outline" className="w-full" onClick={startTwoFactor} disabled={twoFactorBusy}>
                {twoFactorBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {t('Enable two-factor authentication')}
              </Button>
            )}

            {!twoFactorEnabled && twoFactorSetup && (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={twoFactorSetup.qr} alt="TOTP QR" className="mx-auto h-40 w-40 rounded-lg border border-border" />
                <p className="text-center text-xs text-muted-foreground">
                  {t('Scan this QR code with your authenticator app (Google Authenticator, Authy, ...)')}
                </p>
                <div className="space-y-2">
                  <Label>{t('Verification code')}</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="123456"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={enableTwoFactor} disabled={twoFactorBusy || !twoFactorCode}>
                  {twoFactorBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('Verify & Enable')}
                </Button>
                <button
                  onClick={() => setTwoFactorSetup(null)}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('Cancel')}
                </button>
              </div>
            )}

            {twoFactorEnabled && (
              <div className="space-y-2">
                <Label>{t('Enter code or backup code to disable')}</Label>
                <Input
                  inputMode="numeric"
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                />
                <Button variant="destructive" className="w-full" onClick={disableTwoFactor} disabled={twoFactorBusy || !twoFactorCode}>
                  {twoFactorBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('Disable two-factor authentication')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
