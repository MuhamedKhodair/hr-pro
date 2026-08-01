'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Building2, ClipboardCheck, CalendarClock, DollarSign, LogOut, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { logout, getUser } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

type UserRole = 'Admin' | 'HR' | 'Employee';

const navItems = [
  { href: '/dashboard', labelKey: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'HR', 'Employee'] as UserRole[] },
  { href: '/employees', labelKey: 'Employees', icon: Users, roles: ['Admin', 'HR'] as UserRole[] },
  { href: '/departments', labelKey: 'Depts', icon: Building2, roles: ['Admin', 'HR'] as UserRole[] },
  { href: '/attendance', labelKey: 'Attendance', icon: ClipboardCheck, roles: ['Admin', 'HR', 'Employee'] as UserRole[] },
  { href: '/leaves', labelKey: 'Leaves', icon: CalendarClock, roles: ['Admin', 'HR', 'Employee'] as UserRole[] },
  { href: '/salary', labelKey: 'Salary', icon: DollarSign, roles: ['Admin'] as UserRole[] },
];

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const user = getUser();
  const userRole = (user?.role || 'Employee') as UserRole;
  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-xl px-4 gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <nav className="hidden md:flex items-center gap-1">
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
