'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, LogIn, LogOut, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost } from '@/hooks/useApi';
import { useTranslation } from '@/lib/i18n';
import { formatDateTime } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  overtimeHrs: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'Present':
      return 'success' as const;
    case 'HalfDay':
      return 'warning' as const;
    case 'Absent':
      return 'destructive' as const;
    default:
      return 'default' as const;
  }
};

export default function ClockPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [now, setNow] = useState(() => new Date());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const { data: records, isLoading, error, refetch } = useApiGet<AttendanceRecord[]>(['attendance-today'], '/attendance/today');

  const record = records?.find((r) => r.checkIn) ?? records?.[0];

  const checkedIn = Boolean(record?.checkIn);
  const checkedOut = Boolean(record?.checkIn && record?.checkOut);
  const action = checkedIn ? (checkedOut ? 'done' : 'out') : 'in';

  const checkInMutation = useApiPost([['attendance-today']]);
  const checkOutMutation = useApiPost([['attendance-today']]);
  const busy = checkInMutation.isPending || checkOutMutation.isPending;

  const handleCheckIn = async () => {
    try {
      await checkInMutation.mutateAsync({ endpoint: '/attendance/check-in', data: {} });
      addToast(t('Check In'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOutMutation.mutateAsync({ endpoint: '/attendance/check-out', data: {} });
      addToast(t('Check Out'), 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  };

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Clock className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-destructive">{error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t('Retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-8 text-center">
      <div>
        <p className="text-xl font-medium text-muted-foreground">{date}</p>
        <p className="mt-1 font-display text-6xl font-bold tracking-tight tabular-nums">{time}</p>
      </div>

      {record && (
        <Badge variant={statusVariant(record.status)} className="px-3 py-1">
          {record.status}
        </Badge>
      )}

      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <button
          onClick={action === 'in' ? handleCheckIn : action === 'out' ? handleCheckOut : undefined}
          disabled={action === 'done' || busy}
          aria-label={action === 'in' ? t('Check In') : action === 'out' ? t('Check Out') : t('Done')}
          className={[
            'flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full text-white shadow-xl transition-all',
            action === 'in' && !busy && 'bg-emerald-500 hover:bg-emerald-600 hover:shadow-emerald-500/30 active:scale-95 cursor-pointer',
            action === 'out' && !busy && 'bg-rose-500 hover:bg-rose-600 hover:shadow-rose-500/30 active:scale-95 cursor-pointer',
            action === 'done' && 'bg-muted text-muted-foreground cursor-default',
            busy && 'opacity-70',
          ].join(' ')}
        >
          {action === 'in' ? (
            <LogIn className="h-10 w-10" strokeWidth={2.25} />
          ) : action === 'out' ? (
            <LogOut className="h-10 w-10" strokeWidth={2.25} />
          ) : (
            <Clock className="h-10 w-10" strokeWidth={2.25} />
          )}
          <span className="text-lg font-semibold">
            {action === 'in' ? t('Check In') : action === 'out' ? t('Check Out') : t('Day complete')}
          </span>
          <span className="text-xs font-normal opacity-80">
            {action === 'in' ? t('Not checked in yet') : action === 'out' ? t('Working now') : ''}
          </span>
        </button>
      </motion.div>

      <Card className="w-full">
        <CardContent className="space-y-3 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('Checked in at')}</span>
            <span className="font-medium tabular-nums">{record?.checkIn ? formatDateTime(record.checkIn) : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('Checked out at')}</span>
            <span className="font-medium tabular-nums">{record?.checkOut ? formatDateTime(record.checkOut) : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('Overtime (hrs)')}</span>
            <span className="font-medium tabular-nums">{record?.overtimeHrs ? `${record.overtimeHrs}h` : '0h'}</span>
          </div>
        </CardContent>
      </Card>

      {installPrompt && (
        <Button variant="outline" onClick={handleInstall} className="gap-2">
          <Download className="h-4 w-4" /> {t('Install App')}
        </Button>
      )}
    </div>
  );
}