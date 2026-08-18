'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { Bell, CheckCheck, Loader2, Inbox } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface AppNotification {
  id: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

function groupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = (today - day) / 86_400_000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return 'Earlier';
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addToast } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        api.get<AppNotification[]>('/notifications?limit=200'),
        api.get<{ count: number }>('/notifications/unread-count'),
      ]);
      setItems(listRes.data ?? []);
      setUnread(countRes.data?.count ?? 0);
    } catch (err: any) {
      addToast(err.message || t('Failed to load notifications.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, t]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    }
  };

  const openNotification = async (n: AppNotification) => {
    if (!n.read) {
      await api.patch(`/notifications/${n.id}/read`);
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) router.push(n.link);
  };

  const groups = useCallback(() => {
    const order = ['Today', 'Yesterday', 'Earlier'];
    const map = new Map<string, AppNotification[]>();
    for (const n of items) {
      const label = groupLabel(new Date(n.createdAt));
      map.set(label, [...(map.get(label) ?? []), n]);
    }
    return order.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }));
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t('Notification Center')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0 ? (
              <>{unread} {t('unread notifications')}</>
            ) : (
              t('You are all caught up.')
            )}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 me-1" /> {t('Mark all read')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">{t('No notifications yet')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups().map((group) => (
            <div key={group.label}>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">{t(group.label)}</h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {group.items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-border px-5 py-3.5 text-start last:border-0 transition-colors hover:bg-muted/50',
                      !n.read && 'bg-primary/5',
                    )}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-muted-foreground/30' : 'bg-primary')} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm leading-snug', !n.read && 'font-medium')}>{n.message}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                    </span>
                    {n.link && <span className="shrink-0 text-xs text-primary">{t('Open')}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}