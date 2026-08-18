'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useRequireRole } from '@/hooks/useRequireRole';

import { motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { TableSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/tables/data-table';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/tables/table';
import { formatDateTime } from '@/lib/utils';

interface AuditEntry {
  id: string;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

const actionVariant = (action: string): 'success' | 'destructive' | 'warning' | 'secondary' => {
  if (action.includes('CREATED') || action.includes('_APPROVED')) return 'success';
  if (action.includes('DELETED') || action.includes('REJECTED')) return 'destructive';
  if (action.includes('_UPDATED') || action.includes('_FINALIZED') || action.includes('MANUAL')) return 'warning';
  return 'secondary';
};

export default function AuditPage() {
  useRequireRole(['Admin']);
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [actionFilter, setActionFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (actionFilter) params.set('action', actionFilter);
  if (emailFilter) params.set('userEmail', emailFilter);

  const { data, isLoading, error, refetch } = usePaginatedQuery<AuditEntry>(['audit', page, actionFilter, emailFilter], `/audit-logs?${params.toString()}`);
  const logs = data?.items;
  const pagination = data?.pagination;

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('Audit Log')} description={t('Track administrative actions')} />

      <div className="flex flex-wrap gap-3 rounded-lg border p-3">
        <Input
          placeholder={t('Filter by email')}
          className="w-52"
          value={emailFilter}
          onChange={(e) => { setEmailFilter(e.target.value); setPage(1); }}
        />
        <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="w-52">
          <option value="">{t('All actions')}</option>
          <option value="EMPLOYEE_CREATED">EMPLOYEE_CREATED</option>
          <option value="EMPLOYEE_UPDATED">EMPLOYEE_UPDATED</option>
          <option value="EMPLOYEE_DELETED">EMPLOYEE_DELETED</option>
          <option value="EMPLOYEES_BULK_IMPORT">EMPLOYEES_BULK_IMPORT</option>
          <option value="LEAVE_APPROVED">LEAVE_APPROVED</option>
          <option value="LEAVE_REJECTED">LEAVE_REJECTED</option>
          <option value="ATTENDANCE_MANUAL_ENTRY">ATTENDANCE_MANUAL_ENTRY</option>
          <option value="ATTENDANCE_BULK_IMPORT">ATTENDANCE_BULK_IMPORT</option>
          <option value="PAYROLL_GENERATED">PAYROLL_GENERATED</option>
          <option value="PAYROLL_FINALIZED">PAYROLL_FINALIZED</option>
          <option value="SHIFT_CREATED">SHIFT_CREATED</option>
          <option value="SHIFT_UPDATED">SHIFT_UPDATED</option>
          <option value="SHIFT_DELETED">SHIFT_DELETED</option>
        </Select>
      </div>

      {!logs || logs.length === 0 ? (
        <EmptyState icon={ScrollText} title={t('No audit entries')} description={t('Actions will appear here.')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('When')}</TableHead>
              <TableHead>{t('User')}</TableHead>
              <TableHead>{t('Action')}</TableHead>
              <TableHead>{t('Details')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log, i) => (
              <motion.tr
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                <TableCell>{log.userEmail || '-'}</TableCell>
                <TableCell>
                  <Badge variant={actionVariant(log.action)} className="font-mono text-[11px]">{log.action}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[300px] truncate">{log.details || '-'}</TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total} {t('entries')} · {t('Page')} {pagination.page} / {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Previous')}</Button>
            <Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>{t('Next')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

