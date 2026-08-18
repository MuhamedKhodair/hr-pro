'use client';

import { motion } from 'framer-motion';
import { Clock, CalendarRange, Users as UsersIcon } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useApiGet } from '@/hooks/useApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/tables/data-table';

interface MyShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  description: string;
  _count: { employees: number };
}

export default function MyShiftPage() {
  const { t } = useTranslation();
  const { data: shift, isLoading, error } = useApiGet<MyShift | null>(['my-shift'], '/shifts/mine');

  return (
    <div className="space-y-6">
      <PageHeader title={t('My Shift')} description={t('Your assigned work shift and its hours.')} />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : !shift ? (
        <EmptyState icon={CalendarRange} title={t('No shift assigned')} description={t('Contact HR if you believe this is a mistake.')} />
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-semibold">{shift.name}</h2>
                <Badge variant="success">{t('Assigned')}</Badge>
              </div>
              <dl className="mt-6 grid gap-5 sm:grid-cols-3">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('Start')}</dt>
                    <dd className="mt-1 text-lg font-medium">{shift.startTime}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('End')}</dt>
                    <dd className="mt-1 text-lg font-medium">{shift.endTime}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UsersIcon className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('employees')}</dt>
                    <dd className="mt-1 text-lg font-medium">{shift._count.employees}</dd>
                  </div>
                </div>
              </dl>
              {shift.description && (
                <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">{shift.description}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}