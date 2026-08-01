'use client';

import { motion } from 'framer-motion';
import { ClipboardCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost } from '@/hooks/useApi';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/tables/data-table';
import { useTranslation } from '@/lib/i18n';
import { formatDateTime } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  employee: { id: string; name: string; email: string };
}

export default function AttendancePage() {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const { data: records, isLoading, error, refetch } = useApiGet<AttendanceRecord[]>(
    ['attendance-today'],
    '/attendance/today',
  );

  const checkInMutation = useApiPost([['attendance-today']]);
  const checkOutMutation = useApiPost([['attendance-today']]);

  const handleCheckIn = async (employeeId: string) => {
    try {
      await checkInMutation.mutateAsync({ endpoint: '/attendance/check-in', data: { employeeId } });
      addToast('Check-in recorded', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleCheckOut = async (employeeId: string) => {
    try {
      await checkOutMutation.mutateAsync({ endpoint: '/attendance/check-out', data: { employeeId } });
      addToast('Check-out recorded', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const checkedIn = records?.filter((r) => r.checkIn && !r.checkOut) || [];
  const completed = records?.filter((r) => r.checkIn && r.checkOut) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('Attendance')}</h1>
        <p className="text-muted-foreground">{t("Today's attendance log")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('Checked In')}</p>
              <p className="text-xl font-bold">{checkedIn.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-xl font-bold">{completed.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!records || records.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No records today" description="No attendance records for today." />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start text-sm font-medium">Employee</th>
                <th className="px-4 py-3 text-start text-sm font-medium">Check In</th>
                <th className="px-4 py-3 text-start text-sm font-medium">Check Out</th>
                <th className="px-4 py-3 text-start text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-end text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, i) => (
                <motion.tr
                  key={record.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-sm font-medium">{record.employee.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {record.checkIn ? formatDateTime(record.checkIn) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {record.checkOut ? formatDateTime(record.checkOut) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={record.status === 'Present' ? 'success' : 'warning'}>
                      {record.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {!record.checkIn ? (
                      <Button size="sm" onClick={() => handleCheckIn(record.employeeId)} disabled={checkInMutation.isPending}>
                        Check In
                      </Button>
                    ) : !record.checkOut ? (
                      <Button size="sm" variant="outline" onClick={() => handleCheckOut(record.employeeId)} disabled={checkOutMutation.isPending}>
                        Check Out
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Done</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
