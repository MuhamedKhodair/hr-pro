'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Fingerprint,
  Plane,
  LogOut,
  X,
  ChevronLeft,
  Building,
  CalendarRange,
  BarChart3,
  Network,
  Target,
  Settings as SettingsIcon,
  History,
  Wallet,
  UserCircle2,
  Briefcase,
  ClipboardList,
  Bell,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { logout, getUser } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useOrgChart } from '@/components/org-chart/org-chart-provider';
import { useCompanySettings } from '@/lib/settings';
import { assetUrl } from '@/lib/api';
import { memo, useMemo, useState } from 'react';

type UserRole = 'Admin' | 'HR' | 'Employee';

interface NavItem {
  href: string;
  labelKey: string;
  icon: any;
  roles: UserRole[];
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    labelKey: 'Overview',
    items: [
      { href: '/dashboard', labelKey: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'HR'] },
      { href: '/me', labelKey: 'My Profile', icon: UserCircle2, roles: ['Admin', 'HR', 'Employee'] },
      { href: '/me/shift', labelKey: 'My Shift', icon: CalendarRange, roles: ['Admin', 'HR', 'Employee'] },
      { href: '/me/onboarding', labelKey: 'My Onboarding', icon: ClipboardList, roles: ['Admin', 'HR', 'Employee'] },
    ],
  },
  {
    labelKey: 'People',
    items: [
      { href: '/employees', labelKey: 'Employees', icon: Users, roles: ['Admin', 'HR'] },
      { href: '/employees/org-chart', labelKey: 'Org Chart', icon: Network, roles: ['Admin', 'HR'] },
      { href: '/recruitment', labelKey: 'Recruitment', icon: Briefcase, roles: ['Admin', 'HR'] },
      { href: '/onboarding', labelKey: 'Onboarding', icon: ClipboardList, roles: ['Admin', 'HR'] },
      { href: '/performance', labelKey: 'Performance', icon: Target, roles: ['Admin', 'HR'] },
      { href: '/departments', labelKey: 'Departments', icon: Building2, roles: ['Admin', 'HR'] },
    ],
  },
  {
    labelKey: 'Operations',
    items: [
      { href: '/attendance', labelKey: 'Attendance', icon: Fingerprint, roles: ['Admin', 'HR', 'Employee'] },
      { href: '/leaves', labelKey: 'Leave Requests', icon: Plane, roles: ['Admin', 'HR', 'Employee'] },
      { href: '/shifts', labelKey: 'Shifts', icon: CalendarRange, roles: ['Admin', 'HR'] },
      { href: '/holidays', labelKey: 'Holidays', icon: Sun, roles: ['Admin', 'HR', 'Employee'] },
      { href: '/notifications', labelKey: 'Notifications', icon: Bell, roles: ['Admin', 'HR', 'Employee'] },
      { href: '/reports', labelKey: 'Reports', icon: BarChart3, roles: ['Admin', 'HR'] },
    ],
  },
  {
    labelKey: 'Finance',
    items: [
      { href: '/salary', labelKey: 'Salary', icon: Wallet, roles: ['Admin'] },
    ],
  },
  {
    labelKey: 'System',
    items: [
      { href: '/audit', labelKey: 'Audit Log', icon: History, roles: ['Admin'] },
      { href: '/settings', labelKey: 'Settings', icon: SettingsIcon, roles: ['Admin'] },
    ],
  },
];

const currentUser = getUser();
const userRole = (currentUser?.role || 'Employee') as UserRole;

function getVisibleSections(role: UserRole) {
  return navSections
    .map((section) => ({ ...section, items: section.items.filter((i) => i.roles.includes(role)) }))
    .filter((section) => section.items.length > 0);
}

const NavItemLink = memo(function NavItemLink({ item, collapsed, onClose, isActive }: {
  item: NavItem; collapsed: boolean; onClose: () => void; isActive: boolean;
}) {
  const { t } = useTranslation();
  const { openOrgChart } = useOrgChart();
  const handleClick = (e: React.MouseEvent) => {
    if (item.href === '/employees/org-chart') {
      e.preventDefault();
      onClose();
      openOrgChart();
    } else {
      onClose();
    }
  };
  return (
    <Link
      href={item.href}
      onClick={handleClick}
      title={collapsed ? t(item.labelKey) : undefined}
      className={cn(
        'group relative flex items-center rounded-md text-[13px] font-medium leading-none transition-colors',
        collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-[7px]',
        isActive
          ? 'bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(15,23,42,0.35)]'
          : 'text-sidebar-foreground/55 hover:bg-sidebar-muted hover:text-sidebar-foreground',
      )}
    >
      <item.icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          isActive ? 'text-primary-foreground' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground',
        )}
        strokeWidth={2.25}
      />
      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
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

  const sections = useMemo(() => getVisibleSections(userRole), []);

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
            'fixed inset-y-0 z-50 w-64 shadow-2xl lg:hidden bg-sidebar',
            isRtl ? 'right-0' : 'left-0',
          )}
        >
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="absolute end-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <SidebarContent collapsed={false} t={t} onClose={onClose} sections={sections} pathname={pathname} />
        </motion.aside>
      )}

      <aside
        className={cn(
          'relative hidden h-screen self-start lg:sticky lg:top-0 lg:flex lg:flex-col border-e border-border bg-sidebar transition-all duration-200',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <SidebarContent collapsed={collapsed} t={t} onClose={onClose} sections={sections} pathname={pathname} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-[68px] -end-3 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-sidebar-muted text-sidebar-foreground/70 shadow-md transition-colors hover:bg-primary hover:text-white"
        >
          <ChevronLeft className={cn(
            'h-3.5 w-3.5 transition-transform duration-200',
            (isRtl ? !collapsed : collapsed) && 'rotate-180',
          )} />
        </button>
      </aside>
    </>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const settings = useCompanySettings();
  const fallback = { companyName: 'HR Pro', logoPath: '', companyTagline: 'Management System' };
  const brand = settings ?? fallback;
  return (
    <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-border shrink-0', collapsed && 'justify-center px-0')}>
      {brand.logoPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(brand.logoPath)}
          alt={brand.companyName}
          className="h-9 w-9 shrink-0 rounded-lg object-contain"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_1px_3px_color-mix(in_srgb,var(--primary)_50%,transparent)]">
          <Building className="h-5 w-5" strokeWidth={2.25} />
        </div>
      )}
      {!collapsed && (
        <div className="flex flex-col leading-tight min-w-0">
          <span className="truncate font-display text-[15px] font-bold tracking-tight text-sidebar-foreground">{brand.companyName}</span>
          <span className="truncate font-mono text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
            {brand.companyTagline || t('Management System')}
          </span>
        </div>
      )}
    </div>
  );
}

const SidebarContent = memo(function SidebarContent({ collapsed, t, onClose, sections, pathname }: {
  collapsed: boolean; t: (key: string) => string; onClose: () => void; sections: NavSection[]; pathname: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <SidebarBrand collapsed={collapsed} />
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.labelKey} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="mb-1.5 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/35">
                {t(section.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const hasMoreSpecificChild = section.items.some(
                  (i) => i.href !== item.href && i.href.startsWith(item.href + '/') && pathname.startsWith(i.href),
                );
                const isActive =
                  !hasMoreSpecificChild && (pathname === item.href || pathname.startsWith(item.href + '/'));
                return (
                  <NavItemLink
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    onClose={onClose}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-white/5 p-2.5', collapsed && 'flex flex-col items-center gap-2')}>
        {currentUser && (
          <div className={cn('flex items-center gap-3 px-1 py-1.5', collapsed && 'justify-center px-0')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/25 text-xs font-semibold text-white">
              {currentUser.email.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{currentUser.email}</p>
                <p className="truncate text-xs text-sidebar-foreground/45 capitalize">{t(currentUser.role)}</p>
              </div>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'w-full text-sidebar-foreground/55 hover:text-red-300 hover:bg-red-500/10',
            collapsed ? 'h-8 w-8' : 'justify-start gap-3',
          )}
          onClick={logout}
        >
          <LogOut className="h-4 w-4" strokeWidth={2.25} />
          {!collapsed && <span className="text-sm">{t('Sign Out')}</span>}
        </Button>
      </div>
    </div>
  );
});
