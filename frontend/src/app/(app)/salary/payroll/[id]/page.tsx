'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer, CheckCircle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPatch } from '@/hooks/useApi';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { TableSkeleton, ErrorState } from '@/components/tables/data-table';
import { useState } from 'react';

interface PayrollRecordDetail {
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
    email: string;
    department: { name: string } | null;
  };
  components: { id: string; type: string; label: string; amount: number }[];
}

export default function PayslipPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const [finalizeId, setFinalizeId] = useState<string | null>(null);
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const { data: record, isLoading, error, refetch } = useApiGet<PayrollRecordDetail>(
    ['payroll-record', params.id as string],
    `/salary/payroll/${params.id}`,
  );

  const adjustMutation = useApiPatch<any>([['payroll-record', params.id as string]]);
  const finalizeMutation = useApiPost<any>([['payroll-record', params.id as string]]);

  const handleAdjust = async () => {
    if (!adjustReason.trim()) return;
    try {
      await adjustMutation.mutateAsync({
        endpoint: `/salary/payroll/${params.id}`,
        data: { adjustment, adjustmentReason: adjustReason },
      });
      addToast('Payroll adjusted', 'success');
      setAdjustDialog(false);
      refetch();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleFinalize = async () => {
    try {
      await finalizeMutation.mutateAsync({
        endpoint: `/salary/payroll/${params.id}/finalize`,
        data: {},
      });
      addToast('Payroll finalized', 'success');
      setFinalizeId(null);
      refetch();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handlePrint = () => window.print();

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!record) return <p className="text-muted-foreground">Record not found</p>;

  const monthName = new Date(0, record.month - 1).toLocaleString('default', { month: 'long' });
  const additions = record.totalIncentives + record.totalBonuses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Payslip</h1>
            <p className="text-muted-foreground">{record.employee.name} &middot; {monthName} {record.year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {record.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={() => setAdjustDialog(true)}>
                <DollarSign className="h-4 w-4 me-1" /> Adjust
              </Button>
              <Button onClick={() => setFinalizeId(record.id)}>
                <CheckCircle className="h-4 w-4 me-1" /> Finalize
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 me-1" /> Print
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <Card className="print:shadow-none print:border-0">
          <CardHeader className="print:pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">HR Pro Management</CardTitle>
                <p className="text-sm text-muted-foreground">Payslip for {monthName} {record.year}</p>
              </div>
              <Badge variant={record.status === 'FINALIZED' || record.status === 'PAID' ? 'success' : 'warning'}
                className="text-sm px-3 py-1">
                {record.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Employee</p>
                <p className="font-medium">{record.employee.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{record.employee.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-medium">{record.employee.department?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pay Period</p>
                <p className="font-medium">{monthName} {record.year}</p>
              </div>
            </div>

            <div className="border rounded-lg divide-y">
              <div className="flex items-center justify-between p-4 bg-muted/20">
                <span className="font-semibold">Description</span>
                <span className="font-semibold">Amount</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span>Base Salary</span>
                <span className="font-mono">{formatCurrency(record.baseSalary)}</span>
              </div>

              {record.components.filter(c => c.type === 'ALLOWANCE' || c.type === 'INCENTIVE' || c.type === 'BONUS').map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 text-emerald-700">
                  <span className="text-sm">{c.label} <span className="text-xs text-muted-foreground">({c.type})</span></span>
                  <span className="font-mono text-sm">+{formatCurrency(Math.abs(c.amount))}</span>
                </div>
              ))}

              {record.components.filter(c => c.type === 'DEDUCTION').map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 text-destructive">
                  <span className="text-sm">{c.label} <span className="text-xs text-muted-foreground">({c.type})</span></span>
                  <span className="font-mono text-sm">-{formatCurrency(Math.abs(c.amount))}</span>
                </div>
              ))}

              {record.totalDeductions > 0 && (
                <div className="flex items-center justify-between p-4 text-destructive">
                  <span className="text-sm">Attendance Deductions</span>
                  <span className="font-mono text-sm">-{formatCurrency(record.totalDeductions)}</span>
                </div>
              )}

              {record.adjustment !== 0 && (
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm">Manual Adjustment {record.adjustmentReason ? `(${record.adjustmentReason})` : ''}</span>
                  <span className="font-mono text-sm">{record.adjustment > 0 ? '+' : ''}{formatCurrency(record.adjustment)}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-primary/5 font-bold text-lg">
                <span>Net Salary</span>
                <span className="font-mono">{formatCurrency(record.netSalary)}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 print:mt-4">
              <p>Generated: {formatDateTime(record.generatedAt)}</p>
              {record.finalizedAt && <p>Finalized: {formatDateTime(record.finalizedAt)}</p>}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogHeader>
          <DialogTitle>Adjust Payslip</DialogTitle>
          <DialogDescription>Override the net salary with a manual adjustment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Adjustment Amount</label>
            <input type="number" value={adjustment} onChange={(e) => setAdjustment(Number(e.target.value))}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (required)</label>
            <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAdjustDialog(false)}>Cancel</Button>
          <Button onClick={handleAdjust} disabled={!adjustReason.trim()}>Apply</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!finalizeId} onOpenChange={() => setFinalizeId(null)}>
        <DialogHeader>
          <DialogTitle>Finalize Payslip</DialogTitle>
          <DialogDescription>Lock this record. No further adjustments allowed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setFinalizeId(null)}>Cancel</Button>
          <Button onClick={handleFinalize}>Finalize</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
