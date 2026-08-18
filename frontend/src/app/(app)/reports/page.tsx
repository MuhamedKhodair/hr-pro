'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useRequireRole } from '@/hooks/useRequireRole';
import { BarChart3, Users, CalendarCheck2, Fingerprint, Loader2, FileSpreadsheet } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

type Tab = 'payroll' | 'headcount' | 'leave' | 'attendance';

interface PayrollSummary {
  month: number;
  year: number;
  count: number;
  totalPayroll: number;
  totalBaseSalary: number;
  totalDeductions: number;
  totalIncentives: number;
  totalBonuses: number;
  deptBreakdown: Record<string, { total: number; count: number; baseTotal: number }>;
}

interface HeadcountReport {
  departments: { department: string; total: number; active: number; inactive: number; terminated: number }[];
  unassigned: { total: number; active: number; inactive: number; terminated: number };
}

interface LeaveSummary {
  month: number;
  year: number;
  requested: number;
  pending: number;
  approvedCount: number;
  approvedDays: number;
  byType: { type: string; count: number; days: number }[];
}

interface AttendanceSummary {
  month: number;
  year: number;
  employees: number;
  present: number;
  absent: number;
  halfDay: number;
  overtimeHrs: number;
  rows: { employeeId: string; name: string; department: string | null; present: number; absent: number; halfDay: number; overtimeHrs: number }[];
}

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'payroll', label: 'Payroll', icon: BarChart3 },
  { id: 'headcount', label: 'Headcount', icon: Users },
  { id: 'leave', label: 'Leave', icon: CalendarCheck2 },
  { id: 'attendance', label: 'Attendance', icon: Fingerprint },
];

export default function ReportsPage() {
  useRequireRole(['Admin', 'HR']);
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('payroll');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [payroll, setPayroll] = useState<PayrollSummary | null>(null);
  const [headcount, setHeadcount] = useState<HeadcountReport | null>(null);
  const [leave, setLeave] = useState<LeaveSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PayrollSummary>(`/salary/payroll/summary?month=${month}&year=${year}`);
      setPayroll(res.data ?? null);
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [month, year, addToast, t]);

  const loadHeadcount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<HeadcountReport>('/reports/headcount');
      setHeadcount(res.data ?? null);
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  const loadLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<LeaveSummary>(`/reports/leave-summary?month=${month}&year=${year}`);
      setLeave(res.data ?? null);
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [month, year, addToast, t]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AttendanceSummary>(`/reports/attendance-summary?month=${month}&year=${year}`);
      setAttendance(res.data ?? null);
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [month, year, addToast, t]);

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next === 'headcount' && !headcount) loadHeadcount();
    if (next === 'payroll' && !payroll) loadPayroll();
    if (next === 'leave' && !leave) loadLeave();
    if (next === 'attendance' && !attendance) loadAttendance();
  };

  const download = async (path: string, filename: string) => {
    try {
      await api.download(path, filename);
    } catch (err: any) {
      addToast(err.message || t('Export failed'), 'error');
    }
  };

  const monthLabel = `${String(month).padStart(2, '0')}/${year}`;

  const statCard = (label: string, value: string) => (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t('Reports')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('Payroll, headcount, leave and attendance summaries')}</p>
        </div>
        {tab !== 'headcount' && (
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
        {TABS.map((tabs) => (
          <button
            key={tabs.id}
            onClick={() => selectTab(tabs.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === tabs.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <tabs.icon className="h-4 w-4" /> {t(tabs.label)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && tab === 'payroll' && payroll && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-3">
              {statCard(t('Employees paid'), String(payroll.count))}
              {statCard(t('Gross'), formatCurrency(payroll.totalBaseSalary + payroll.totalIncentives + payroll.totalBonuses))}
              {statCard(t('Deductions'), formatCurrency(payroll.totalDeductions))}
              {statCard(t('Net payroll'), formatCurrency(payroll.totalPayroll))}
            </div>
            <Button variant="outline" size="sm" onClick={() => download(`/salary/payroll/export/csv?month=${month}&year=${year}`, `payroll-${year}-${String(month).padStart(2, '0')}.csv`)}>
              <FileSpreadsheet className="h-4 w-4 me-1" /> CSV
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{t('Department')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Employees')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Base')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Net')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(payroll.deptBreakdown).map(([dept, d]) => (
                  <tr key={dept}>
                    <td className="px-4 py-2.5">{dept}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{d.count}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{formatCurrency(d.baseTotal)}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{formatCurrency(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'headcount' && headcount && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {statCard(t('Departments'), String(headcount.departments.length))}
            {statCard(t('Total'), String(headcount.departments.reduce((s, d) => s + d.total, 0) + headcount.unassigned.total))}
            {statCard(t('Active'), String(headcount.departments.reduce((s, d) => s + d.active, 0) + headcount.unassigned.active))}
            {statCard(t('Terminated'), String(headcount.departments.reduce((s, d) => s + d.terminated, 0) + headcount.unassigned.terminated))}
            <Button variant="outline" size="sm" className="self-start" onClick={() => download('/reports/headcount?format=csv', 'headcount.csv')}>
              <FileSpreadsheet className="h-4 w-4 me-1" /> CSV
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{t('Department')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Total')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Active')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Inactive')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Terminated')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {headcount.departments.map((d) => (
                  <tr key={d.department}>
                    <td className="px-4 py-2.5">{d.department}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{d.total}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{d.active}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{d.inactive}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{d.terminated}</td>
                  </tr>
                ))}
                {headcount.unassigned.total > 0 && (
                  <tr className="bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{t('Unassigned')}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{headcount.unassigned.total}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{headcount.unassigned.active}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{headcount.unassigned.inactive}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{headcount.unassigned.terminated}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'leave' && leave && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-3">
              {statCard(t('Approved requests'), String(leave.approvedCount))}
              {statCard(t('Approved days'), String(leave.approvedDays))}
              {statCard(t('Pending'), String(leave.pending))}
            </div>
            <Button variant="outline" size="sm" onClick={() => download(`/reports/leave-summary?month=${month}&year=${year}&format=csv`, `leave-summary-${monthLabel.replace('/', '-')}.csv`)}>
              <FileSpreadsheet className="h-4 w-4 me-1" /> CSV
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{t('Leave type')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Requests')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Days')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leave.byType.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={3}>{t('No approved leave in this period')}</td>
                  </tr>
                )}
                {leave.byType.map((r) => (
                  <tr key={r.type}>
                    <td className="px-4 py-2.5">{r.type}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{r.count}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{r.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'attendance' && attendance && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-3">
              {statCard(t('Employees'), String(attendance.employees))}
              {statCard(t('Present days'), String(attendance.present))}
              {statCard(t('Absent days'), String(attendance.absent))}
              {statCard(t('Half days'), String(attendance.halfDay))}
              {statCard(t('Overtime hours'), String(attendance.overtimeHrs))}
            </div>
            <Button variant="outline" size="sm" onClick={() => download(`/reports/attendance-summary?month=${month}&year=${year}&format=csv`, `attendance-summary-${monthLabel.replace('/', '-')}.csv`)}>
              <FileSpreadsheet className="h-4 w-4 me-1" /> CSV
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{t('Employee')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('Department')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Present')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Absent')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Half Day')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('Overtime')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendance.rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>{t('No attendance records in this period')}</td>
                  </tr>
                )}
                {attendance.rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.department ?? t('None')}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{r.present}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{r.absent}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{r.halfDay}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{r.overtimeHrs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab !== 'headcount' && !payroll && !leave && !attendance && tab === 'payroll' && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          <Button onClick={loadPayroll}>{t('Generate report')}</Button>
        </div>
      )}
    </div>
  );
}