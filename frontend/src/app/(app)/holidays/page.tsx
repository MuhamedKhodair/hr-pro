'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useApiGet } from '@/hooks/useApi';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/tables/data-table';
import { formatDate } from '@/lib/utils';

interface Holiday {
  id: string;
  name: string;
  date: string;
}

export default function HolidaysPage() {
  const { t } = useTranslation();
  const { data: holidays, isLoading, error } = useApiGet<Holiday[]>(['holidays'], '/holidays');

  const years = useMemo(() => {
    if (!holidays) return [];
    const set = new Set(holidays.map((h) => new Date(h.date).getFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [holidays]);

  const [year, setYear] = useState<number | ''>('');

  const filtered = useMemo(() => {
    if (!holidays) return [];
    return holidays
      .filter((h) => (year === '' ? true : new Date(h.date).getFullYear() === year))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [holidays, year]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Holidays')}
        description={t('Upcoming and past company holidays.')}
        actions={
          holidays && holidays.length > 0 ? (
            <Select value={String(year)} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('All years')}</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          ) : undefined
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Sun} title={t('No holidays scheduled')} description={t('Holidays will appear here once they are set.')} />
      ) : (
        <div className="grid gap-3">
          {filtered.map((holiday, i) => {
            const date = new Date(holiday.date);
            const upcoming = date.getTime() >= today.getTime();
            return (
              <motion.div key={holiday.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sun className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{holiday.name}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(holiday.date)}</p>
                      </div>
                    </div>
                    {upcoming ? (
                      <Badge variant="success">{t('Upcoming')}</Badge>
                    ) : (
                      <Badge variant="secondary">{t('Past')}</Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}