'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  ClipboardCheck,
  CalendarClock,
  DollarSign,
  LogOut,
  X,
  ChevronLeft,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { logout, getUser } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { memo, useMemo, useState } from 'react';

type UserRole = 'Admin' | 'HR' | 'Employee';

interface NavItem {
  href: string;
  labelKey: string;
  icon: any;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'HR', 'Employee'] },
  { href: '/employees', labelKey: 'Employees', icon: Users, roles: ['Admin', 'HR'] },
  { href: '/departments', labelKey: 'Departments', icon: Building2, roles: ['Admin', 'HR'] },
  { href: '/attendance', labelKey: 'Attendance', icon: ClipboardCheck, roles: ['Admin', 'HR', 'Employee'] },
  { href: '/leaves', labelKey: 'Leave Requests', icon: CalendarClock, roles: ['Admin', 'HR', 'Employee'] },
  { href: '/salary', labelKey: 'Salary', icon: DollarSign, roles: ['Admin'] },
];

const currentUser = getUser();
const userRole = (currentUser?.role || 'Employee') as UserRole;
const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

const NavItemLink = memo(function NavItemLink({ item, collapsed, onClose, isActive }: {
  item: NavItem; collapsed: boolean; onClose: () => void; isActive: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center rounded-md text-sm font-medium transition-colors',
        collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{t(item.labelKey)}</span>}
    </Link>
  );
});

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t, dir: rtlDir } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const isRtl = rtlDir === 'rtl';

  const slideVariant = useMemo(() => ({
    open: { x: 0 },
    closed: { x: isRtl ? '100%' : '-100%' },
  }), [isRtl]);

  const navLinks = useMemo(() => visibleItems.map((item) => (
    <NavItemLink
      key={item.href}
      item={item}
      collapsed={collapsed}
      onClose={onClose}
      isActive={pathname.startsWith(item.href)}
    />
  )), [pathname, collapsed, onClose]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {open && (
        <motion.aside
          key="mobile-sidebar"
          variants={slideVariant}
          initial="closed"
          animate="open"
          exit="closed"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'fixed inset-y-0 z-50 w-64 shadow-xl lg:hidden bg-sidebar',
            isRtl ? 'right-0' : 'left-0',
          )}
        >
          <div className="flex items-center justify-between h-14 px-3 border-b border-border">
            <span />
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <SidebarContent collapsed={collapsed} t={t} onClose={onClose} navLinks={navLinks} />
          </div>
        </motion.aside>
      )}

      <aside
        className={cn(
          'hidden lg:flex h-full flex-col border-e border-border bg-sidebar transition-all duration-200',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <SidebarContent collapsed={collapsed} t={t} onClose={onClose} navLinks={navLinks} />
      </aside>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'absolute top-[72px] hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:shadow-md transition-shadow z-10 lg:flex',
          isRtl ? '-start-3' : '-end-3',
        )}
      >
        <ChevronLeft className={cn(
          'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
          (isRtl ? !collapsed : collapsed) && 'rotate-180',
        )} />
      </button>
    </>
  );
}

const SidebarContent = memo(function SidebarContent({ collapsed, t, onClose, navLinks }: {
  collapsed: boolean; t: (key: string) => string; onClose: () => void; navLinks: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-border', collapsed && 'justify-center px-0')}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/10">
          <Building className="h-5 w-5 text-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">HR Pro</span>
            <span className="text-[11px] text-muted-foreground">{t('Management System')}</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-4 overflow-y-auto">
        {navLinks}
      </nav>

      <div className={cn('border-t border-border p-3', collapsed && 'flex flex-col items-center gap-2')}>
        {currentUser && (
          <div className={cn('flex items-center gap-3 px-1 py-2', collapsed && 'justify-center px-0')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {currentUser.email.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{currentUser.email}</p>
                <p className="truncate text-xs text-muted-foreground capitalize">{t(currentUser.role)}</p>
              </div>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10',
            collapsed ? 'h-8 w-8' : 'justify-start gap-3',
          )}
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="text-sm">{t('Sign Out')}</span>}
        </Button>
      </div>
    </div>
  );
});
