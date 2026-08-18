'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface AppNotification {
  id: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

let wsCache: WebSocket | null = null;

function getWsUrl(): string {
  const url = new URL(API_URL);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/ws`;
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        api.get<AppNotification[]>('/notifications'),
        api.get<{ count: number }>('/notifications/unread-count'),
      ]);
      if (listRes.data) setItems(listRes.data);
      setUnread(countRes.data?.count ?? 0);
    } catch {
      /* ignore polling errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = async () => {
      try {
        const res = await api.get<{ token: string }>('/auth/ws-token');
        const token = res.data?.token;
        if (!token || disposed) return;
        wsCache?.close();
        const ws = new WebSocket(`${getWsUrl()}?token=${encodeURIComponent(token)}`);
        wsCache = ws;
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'push' && payload.event === 'notification') {
              load();
            }
          } catch {
            /* ignore malformed pushes */
          }
        };
        ws.onclose = () => {
          if (disposed || ws !== wsCache) return;
          retryTimer = setTimeout(connect, 15_000);
        };
      } catch {
        /* ws unavailable — polling covers it */
      }
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsCache?.close();
      wsCache = null;
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const openNotification = async (n: AppNotification) => {
    setOpen(false);
    if (!n.read) {
      await api.patch(`/notifications/${n.id}/read`);
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 rounded-xl border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</p>
            )}
            {!loading &&
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b px-4 py-3 text-start transition-colors last:border-0 hover:bg-muted/50',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-muted-foreground/30' : 'bg-primary')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">{n.message}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                  </span>
                </button>
              ))}
          </div>
          <div className="flex items-center justify-end border-t px-4 py-2">
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
