'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { DollarSign, Plus, CheckCircle, Eye, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPatch } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/tables/data-table';

interface PayrollRecord {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  baseSalary: number;
  totalDeductions: number;
  totalIncentives: number;
  totalBonuses: number;
  netSalary: number;
  status: string;
  adjustment: number;
  adjustmentReason: string | null;
  generatedAt: string;
  finalizedAt: string | null;
  employee: {
    id: string;
    name: string;
    department: { name: string } | null;
  };
  components: { type: string; label: string; amount: number }[];
}

interface Employee {
  id: string;
  name: string;
  department: { name: string } | null;
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'PAID': return 'success' as const;
    case 'FINALIZED': return 'default' as const;
    default: return 'warning' as const;
  }
};

export default function PayrollPage() {
  const { addToast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [genDialog, setGenDialog] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<string | null>(null);
  const [finalizeId, setFinalizeId] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const { data: records, isLoading, error, refetch } = useApiGet<PayrollRecord[]>(
    ['payroll-records', String(month), String(year)],
    `/salary/payroll?month=${month}&year=${year}`,
  );

  const { data: employees } = useApiGet<Employee[]>(['salary-employees'], '/salary/employees');

  const generateMutation = useApiPost<any>([['payroll-records', String(month), String(year)]]);
  const adjustMutation = useApiPatch<any>([['payroll-records', String(month), String(year)]]);
  const finalizeMutation = useApiPost<any>([['payroll-records', String(month), String(year)]]);

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        endpoint: '/salary/payroll/generate',
        data: { allEmployees: true, month, year },
      });
      addToast('Payroll generated', 'success');
      setGenDialog(false);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleAdjust = async () => {
    if (!adjustDialog || !adjustReason.trim()) return;
    try {
      await adjustMutation.mutateAsync({
        endpoint: `/salary/payroll/${adjustDialog}`,
        data: { adjustment, adjustmentReason: adjustReason },
      });
      addToast('Payroll adjusted', 'success');
      setAdjustDialog(null);
      setAdjustReason('');
      setAdjustment(0);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleFinalize = async () => {
    if (!finalizeId) return;
    try {
      await finalizeMutation.mutateAsync({
        endpoint: `/salary/payroll/${finalizeId}/finalize`,
        data: {},
      });
      addToast('Payroll finalized', 'success');
      setFinalizeId(null);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payroll Records</h1>
          <p className="text-muted-foreground">Generate, review, and finalize monthly payroll</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="w-28">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
            ))}
          </Select>
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
          <Button onClick={() => setGenDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Generate
          </Button>
        </div>
      </div>

      {!records || records.length === 0 ? (
        <EmptyState icon={DollarSign} title="No payroll records" description={`Generate payroll for ${new Date(0, month - 1).toLocaleString('default', { month: 'long' })} ${year}.`} />
      ) : (
        <div className="rounded-lg border">
          <div className="hidden sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start text-sm font-medium">Employee</th>
                  <th className="px-4 py-3 text-end text-sm font-medium">Base Salary</th>
                  <th className="px-4 py-3 text-end text-sm font-medium">Deductions</th>
                  <th className="px-4 py-3 text-end text-sm font-medium">Additions</th>
                  <th className="px-4 py-3 text-end text-sm font-medium">Net Salary</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-end text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      {r.employee.name}
                      <span className="block text-xs text-muted-foreground">{r.employee.department?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-end font-mono">{formatCurrency(r.baseSalary)}</td>
                    <td className="px-4 py-3 text-sm text-end font-mono text-destructive">{formatCurrency(r.totalDeductions)}</td>
                    <td className="px-4 py-3 text-sm text-end font-mono text-emerald-600">{formatCurrency(r.totalIncentives + r.totalBonuses)}</td>
                    <td className="px-4 py-3 text-sm text-end font-mono font-bold">{formatCurrency(r.netSalary)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex justify-end gap-1">
                        <Link href={`/salary/payroll/${r.id}`}>
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        {r.status === 'DRAFT' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => { setAdjustDialog(r.id); setAdjustment(0); setAdjustReason(''); }}>
                              <DollarSign className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setFinalizeId(r.id)}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 p-4 sm:hidden">
            {records.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{r.employee.name}</p>
                        <p className="text-xs text-muted-foreground">{r.employee.department?.name}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-bold font-mono">{formatCurrency(r.netSalary)}</p>
                        <Badge variant={statusVariant(r.status)} className="mt-1">{r.status}</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Base: {formatCurrency(r.baseSalary)}</span>
                      <span>Ded: {formatCurrency(r.totalDeductions)}</span>
                      <span>Add: {formatCurrency(r.totalIncentives + r.totalBonuses)}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Link href={`/salary/payroll/${r.id}`}>
                        <Button size="sm" variant="outline" className="w-full">
                          <Eye className="h-3 w-3 me-1" /> View
                        </Button>
                      </Link>
                      {r.status === 'DRAFT' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setAdjustDialog(r.id); setAdjustment(0); setAdjustReason(''); }}>
                            Adjust
                          </Button>
                          <Button size="sm" onClick={() => setFinalizeId(r.id)}>
                            Finalize
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={genDialog} onOpenChange={setGenDialog}>
        <DialogHeader>
          <DialogTitle>Generate Payroll</DialogTitle>
          <DialogDescription>Generate payroll for {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year} for all active employees.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will create payroll records for all active employees. Existing records will be skipped.
            After generation, review each record before finalizing.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setGenDialog(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? 'Generating...' : 'Generate All'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!adjustDialog} onOpenChange={() => setAdjustDialog(null)}>
        <DialogHeader>
          <DialogTitle>Adjust Payroll</DialogTitle>
          <DialogDescription>Override the net salary with a manual adjustment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Adjustment Amount</Label>
            <Input type="number" value={adjustment} onChange={(e) => setAdjustment(Number(e.target.value))} placeholder="e.g. -500 or 200" />
            <p className="text-xs text-muted-foreground">Positive = increase net salary; Negative = decrease</p>
          </div>
          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Salary correction" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancel</Button>
          <Button onClick={handleAdjust} disabled={!adjustReason.trim()}>Apply Adjustment</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!finalizeId} onOpenChange={() => setFinalizeId(null)}>
        <DialogHeader>
          <DialogTitle>Finalize Payroll</DialogTitle>
          <DialogDescription>Lock this payroll record. No further adjustments will be allowed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFinalizeId(null)}>Cancel</Button>
          <Button onClick={handleFinalize}>Finalize</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
