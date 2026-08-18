'use client';

import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { NotificationsBell } from '@/components/layout/notifications-bell';
import { GlobalSearch } from '@/components/layout/global-search';
import { logout, getUser } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const { t } = useTranslation();
  const user = getUser();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="lg:hidden">
          <span className="text-sm font-semibold tracking-tight">{t('HR Pro')}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <GlobalSearch />
        <NotificationsBell />
        <LanguageSwitcher />
        <ThemeToggle />
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {user?.email.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-xs text-muted-foreground md:block">{user?.email}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8" aria-label={t('Sign Out')}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
