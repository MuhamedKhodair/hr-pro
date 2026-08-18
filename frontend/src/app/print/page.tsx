'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, X } from 'lucide-react';
import { api, assetUrl } from '@/lib/api';
import { fetchSettings } from '@/lib/settings';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function unwrap(res: any): any[] {
  if (!res?.data) return [];
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data.data)) return res.data.data;
  return [];
}

interface Row {
  [key: string]: string | number;
}

const COLUMNS: Record<string, { header: string; key: string }[]> = {
  employees: [
    { header: '#', key: '#' },
    { header: 'Name', key: 'Name' },
    { header: 'Email', key: 'Email' },
    { header: 'Phone', key: 'Phone' },
    { header: 'Department', key: 'Department' },
    { header: 'Position', key: 'Position' },
    { header: 'Hire Date', key: 'Hire Date' },
    { header: 'Salary', key: 'Salary' },
    { header: 'Status', key: 'Status' },
  ],
  leaves: [
    { header: '#', key: '#' },
    { header: 'Employee', key: 'Employee' },
    { header: 'Type', key: 'Type' },
    { header: 'Start Date', key: 'Start Date' },
    { header: 'End Date', key: 'End Date' },
    { header: 'Days', key: 'Days' },
    { header: 'Status', key: 'Status' },
    { header: 'Reason', key: 'Reason' },
  ],
  attendance: [
    { header: '#', key: '#' },
    { header: 'Employee', key: 'Employee' },
    { header: 'Date', key: 'Date' },
    { header: 'Check In', key: 'Check In' },
    { header: 'Check Out', key: 'Check Out' },
    { header: 'Status', key: 'Status' },
    { header: 'Overtime', key: 'Overtime' },
    { header: 'Notes', key: 'Notes' },
  ],
  payroll: [
    { header: '#', key: '#' },
    { header: 'Employee', key: 'Employee' },
    { header: 'Department', key: 'Department' },
    { header: 'Base Salary', key: 'Base Salary' },
    { header: 'Deductions', key: 'Deductions' },
    { header: 'Incentives', key: 'Incentives' },
    { header: 'Bonuses', key: 'Bonuses' },
    { header: 'Net Salary', key: 'Net Salary' },
    { header: 'Status', key: 'Status' },
  ],
};

const TITLES: Record<string, string> = {
  employees: 'Employees Report',
  leaves: 'Leave Requests Report',
  attendance: 'Attendance Report',
  payroll: 'Payroll Report',
};

function fmtDate(d?: string) {
  if (!d) return '';
  return String(d).slice(0, 10);
}

function PrintView() {
  const params = useSearchParams();
  const { t, dir } = useTranslation();
  const type = params.get('type') || 'employees';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [brand, setBrand] = useState<{ companyName: string; logoPath: string; companyTagline: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const endpoint =
          type === 'attendance'
            ? `/attendance/range?start=${params.get('start') || ''}&end=${params.get('end') || ''}`
            : type === 'payroll'
              ? `/salary/payroll?month=${params.get('month') || ''}&year=${params.get('year') || ''}`
              : type === 'leaves'
                ? '/leaves'
                : '/employees?page=1&pageSize=100';
        const [res, settings] = await Promise.all([
          api.get<any>(endpoint),
          fetchSettings().catch(() => null),
        ]);
        if (cancelled) return;
        let items = unwrap(res);
        const today = new Date().toISOString().slice(0, 10);

        if (type === 'employees') {
          items = items.map((e: any, i: number) => ({
            '#': i + 1,
            Name: e.name,
            Email: e.email,
            Phone: e.phone ?? '',
            Department: e.department?.name ?? '',
            Position: e.position,
            'Hire Date': fmtDate(e.hireDate),
            Salary: e.salary,
            Status: e.status,
          }));
        } else if (type === 'leaves') {
          items = items.map((l: any, i: number) => ({
            '#': i + 1,
            Employee: l.employee?.name ?? '',
            Type: l.type,
            'Start Date': fmtDate(l.startDate),
            'End Date': fmtDate(l.endDate),
            Days: l.totalDays,
            Status: l.isCancelled ? 'Cancelled' : l.status,
            Reason: l.reason ?? '',
          }));
        } else if (type === 'attendance') {
          items = items.map((a: any, i: number) => ({
            '#': i + 1,
            Employee: a.employee?.name ?? '',
            Date: fmtDate(a.date),
            'Check In': a.checkIn ? new Date(a.checkIn).toLocaleString() : '',
            'Check Out': a.checkOut ? new Date(a.checkOut).toLocaleString() : '',
            Status: a.status,
            Overtime: a.overtimeHrs || 0,
            Notes: a.notes ?? '',
          }));
        } else if (type === 'payroll') {
          items = items.map((r: any, i: number) => ({
            '#': i + 1,
            Employee: r.employee?.name ?? '',
            Department: r.employee?.department?.name ?? '',
            'Base Salary': r.baseSalary,
            Deductions: r.totalDeductions,
            Incentives: r.totalIncentives,
            Bonuses: r.totalBonuses,
            'Net Salary': r.netSalary,
            Status: r.status,
          }));
        }
        setRows(items);
        setBrand(settings ? { companyName: settings.companyName, logoPath: settings.logoPath, companyTagline: settings.companyTagline } : null);
        if (!params.get('preview')) {
          setTimeout(() => window.print(), 600);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load report');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const columns = COLUMNS[type] || COLUMNS.employees;
  const title = TITLES[type] || TITLES.employees;
  const totals = useMemo(() => {
    if (!rows) return null;
    const sums: Record<string, number> = {};
    ['Salary', 'Days', 'Overtime', 'Base Salary', 'Deductions', 'Incentives', 'Bonuses', 'Net Salary'].forEach((k) => {
      const total = rows.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
      const used = rows.some((r) => r[k] !== undefined);
      if (used) sums[k] = total;
    });
    return sums;
  }, [rows]);

  const rangeLabel =
    type === 'attendance'
      ? `${params.get('start') || ''} → ${params.get('end') || ''}`
      : type === 'payroll'
        ? `${new Date(0, (Number(params.get('month')) || 1) - 1).toLocaleString('default', { month: 'long' })} ${params.get('year') || ''}`
        : '';

  return (
    <div dir={dir} className="min-h-screen bg-[#eef0f4] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card p-3 print:hidden">
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> {t('Print / Save PDF')}
          </Button>
          <Button variant="ghost" onClick={() => window.close()} className="gap-2">
            <X className="h-4 w-4" /> Close
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">{error}</div>
        ) : !rows ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm print:shadow-none print:border-0">
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                {brand?.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(brand.logoPath)} alt={brand.companyName} className="h-10 w-10 rounded-lg object-contain" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {(brand?.companyName || 'HR').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="font-display text-lg font-semibold tracking-tight">{brand?.companyName || 'HR Pro'}</h1>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {brand?.companyTagline || 'Management System'}
                  </p>
                </div>
              </div>
              <div className="text-end">
                <h2 className="font-display text-base font-semibold">{title}</h2>
                <p className="text-xs text-muted-foreground">
                  Generated {new Date().toLocaleDateString()}{rangeLabel ? ` · ${rangeLabel}` : ''}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-primary text-start text-primary-foreground">
                    {columns.map((c) => (
                      <th key={c.key} className="px-4 py-2.5 text-start font-medium whitespace-nowrap">
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                        {t('No data for this report')}
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-muted/40' : ''}>
                      {columns.map((c) => (
                        <td key={c.key} className="border-t border-border px-4 py-2 whitespace-nowrap">
                          {r[c.key] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {totals && Object.keys(totals).length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/60 font-semibold">
                      {columns.map((c) => (
                        <td key={c.key} className="px-4 py-2 whitespace-nowrap">
                          {totals[c.key] !== undefined ? Number(totals[c.key]).toLocaleString() : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {type === 'payroll' && totals && totals['Net Salary'] !== undefined && (
              <div className="border-t border-border px-6 py-3 text-sm">
                <span className="text-muted-foreground">Total Net Payroll: </span>
                <span className="font-semibold tabular-nums">{totals['Net Salary'].toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground print:hidden">
              Tip: use the browser print dialog and choose &quot;Save as PDF&quot;.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body { background: #fff !important; }
          @page { margin: 14mm; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#eef0f4]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PrintView />
    </Suspense>
  );
}