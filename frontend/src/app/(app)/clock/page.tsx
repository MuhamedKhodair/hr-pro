'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, LogIn, LogOut, Download, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost } from '@/hooks/useApi';
import { useTranslation } from '@/lib/i18n';
import { getUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  overtimeHrs: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
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
  const me = getUser();

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

  const { data: records, isLoading, error, refetch } = useApiGet<AttendanceRecord[]>(['attendance-today', me?.email ?? ''], '/attendance/today?self=1');

  const record = records?.find((r) => r.checkIn) ?? records?.[0];

  const checkedIn = Boolean(record?.checkIn);
  const checkedOut = Boolean(record?.checkIn && record?.checkOut);
  const action = checkedIn ? (checkedOut ? 'done' : 'out') : 'in';

  const checkInMutation = useApiPost([['attendance-today']]);
  const checkOutMutation = useApiPost([['attendance-today']]);
  const busy = checkInMutation.isPending || checkOutMutation.isPending;
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const getPosition = () =>
    new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
      const requestFix = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
            }),
          (err) =>
            reject(
              err.code === err.PERMISSION_DENIED
                ? new Error(t('GPS turned off on device'))
                : new Error(t('Location unavailable')),
            ),
          { enableHighAccuracy: true, timeout: 12000 },
        );
      };

      if (!('geolocation' in navigator)) {
        reject(new Error(t('Location not supported by this browser')));
        return;
      }
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        navigator.permissions
          .query({ name: 'geolocation' as PermissionName })
          .then((status) => {
            if (status.state === 'denied') {
              reject(new Error(t('GPS turned off on device')));
              return;
            }
            requestFix();
          })
          .catch(() => requestFix());
        return;
      }
      requestFix();
    });

  const handleCheckIn = async () => {
    try {
      setLocating(true);
      setLocationError(null);
      const { latitude, longitude, accuracy } = await getPosition();
      await checkInMutation.mutateAsync({ endpoint: '/attendance/check-in', data: { latitude, longitude, accuracy, self: true } });
      addToast(t('Check In'), 'success');
    } catch (err: any) {
      setLocationError(err.message);
    } finally {
      setLocating(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOutMutation.mutateAsync({ endpoint: '/attendance/check-out', data: { self: true } });
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
        {me?.email && <p className="mt-2 font-mono text-xs text-muted-foreground">{me.email}</p>}
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
          {locating ? (
            <Loader2 className="h-10 w-10 animate-spin" strokeWidth={2.25} />
          ) : action === 'in' ? (
            <LogIn className="h-10 w-10" strokeWidth={2.25} />
          ) : action === 'out' ? (
            <LogOut className="h-10 w-10" strokeWidth={2.25} />
          ) : (
            <Clock className="h-10 w-10" strokeWidth={2.25} />
          )}
          <span className="text-lg font-semibold">
            {locating
              ? t('Getting your location…')
              : action === 'in'
                ? t('Check In')
                : action === 'out'
                  ? t('Check Out')
                  : t('Day complete')}
          </span>
          <span className="text-xs font-normal opacity-80">
            {locating
              ? ''
              : action === 'in'
                ? t('Not checked in yet')
                : action === 'out'
                  ? t('Working now')
                  : ''}
          </span>
        </button>
      </motion.div>

      {action === 'in' && !locating && !locationError && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {t('Location required for check-in')}
        </p>
      )}

      {locationError && action === 'in' && (
        <div className="w-full rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-start">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <MapPin className="h-4 w-4" /> {locationError}
          </p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-muted-foreground">
            <li>{t('Android: enable Location in Settings, then refresh and Allow')}</li>
            <li>{t('iPhone: Settings → Privacy → Location Services → turn on for this browser')}</li>
            <li>{t('Then press the button again — a GPS fix forwards the browser permission popup')}</li>
          </ul>
          <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => setLocationError(null)}>
            <MapPin className="h-3.5 w-3.5" /> {t('Try Again')}
          </Button>
        </div>
      )}

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
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('Location')}</span>
            {record?.latitude != null && record.longitude != null ? (
              <span className="flex items-center gap-2">
                {record.accuracy != null && (
                  <span className="text-xs text-muted-foreground">
                    ±{record.accuracy > 999 ? (record.accuracy / 1000).toFixed(1) + 'km' : record.accuracy + 'm'}
                  </span>
                )}
                <a
                  href={`https://maps.google.com/?q=${record.latitude},${record.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {t('Open in Maps')}
                </a>
              </span>
            ) : (
              <span className="font-medium tabular-nums">—</span>
            )}
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