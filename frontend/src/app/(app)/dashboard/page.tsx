'use client';

import { useTranslation } from '@/lib/i18n';
import { Users, Building2, CalendarClock, ClipboardCheck, Cake, Award, Activity } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';
import { LeaveChart } from '@/components/dashboard/leave-chart';
import { AttendanceChart } from '@/components/dashboard/attendance-chart';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/tables/data-table';
import { useApiGet } from '@/hooks/useApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { formatDate, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isAdminOrHr } from '@/lib/auth';
import { ChartTooltip } from '@/components/dashboard/chart-tooltip';
import { OrgChartCard } from '@/components/org-chart/org-chart-card';

interface DashboardStats {
  totalEmployees: number;
  totalDepartments: number;
  pendingLeaves: number;
  todayAttendance: number;
  leaveTrend: { status: string; _count: number }[];
  attendanceTrend: { date: string; status: string }[];
}

interface Headcount {
  byDepartment: { name: string; count: number }[];
  unassigned: number;
}

interface Upcoming {
  birthdays: { id: string; name: string; department: string; date: string; daysUntil: number }[];
  anniversaries: { id: string; name: string; department: string; date: string; years: number; daysUntil: number }[];
}

interface ActivityItem {
  type: 'leave' | 'checkin' | 'employee_added';
  message: string;
  at: string;
}

interface LeaveEvent {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  employee: { name: string };
}

function LeaveCalendarWidget() {
  const { t } = useTranslation();
  const isManager = isAdminOrHr();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const { data: leaves } = useApiGet<LeaveEvent[]>(['calendar-leaves'], isManager ? '/leaves' : '/leaves/my');

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const leavesOn = (day: number) =>
    (leaves ?? []).filter((l) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const d = new Date(year, month, day);
      return d >= start && d <= end;
    });

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">{t('Leave Calendar')}</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">
            {new Date(year, month).toLocaleString('default', { month: 'long' })} {year}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-[10px] font-semibold text-muted-foreground">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;
            const evts = leavesOn(day);
            const isToday = day === now.getDate();
            return (
              <div
                key={day}
                className={cn(
                  'relative flex h-9 flex-col items-center justify-center rounded-md text-xs',
                  isToday ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted/50',
                  evts.length > 0 && !isToday && 'bg-primary/10 text-primary',
                )}
              >
                <span>{day}</span>
                {evts.length > 0 && (
                  <span className={cn(
                    'absolute bottom-1 h-1.5 w-1.5 rounded-full',
                    evts.some((e) => e.status === 'Approved') ? 'bg-emerald-500' : 'bg-amber-500',
                  )} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-2">
          {leaves && leaves.filter((l) => leavesOn(now.getDate()).some((e) => e.id === l.id) || (new Date(l.startDate).getMonth() === month && new Date(l.startDate).getFullYear() === year)).slice(0, 5).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{l.employee.name} — {l.type}</span>
              <Badge variant={l.status === 'Approved' ? 'success' : 'warning'} className="shrink-0 text-[10px]">{l.status}</Badge>
            </div>
          ))}
          {(!leaves || leaves.length === 0) && (
            <p className="text-xs text-muted-foreground">{t('No leaves this month')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const activityIcon = (type: ActivityItem['type']) => {
  if (type === 'leave') return CalendarClock;
  if (type === 'checkin') return ClipboardCheck;
  return Users;
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useApiGet<DashboardStats>(['dashboard'], '/dashboard/stats');
  const { data: headcount } = useApiGet<Headcount>(['headcount'], '/dashboard/headcount');
  const { data: upcoming } = useApiGet<Upcoming>(['upcoming'], '/dashboard/upcoming');
  const { data: activity } = useApiGet<ActivityItem[]>(['activity'], '/dashboard/activity');

  const router = useRouter();
  useEffect(() => {
    if (!isAdminOrHr()) router.replace('/me');
  }, [router]);

  if (isLoading) return <DashboardSkeleton />;
  if (!stats) return <p className="text-muted-foreground">{t('No data available.')}</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={t('Dashboard')} description={t('Overview of your HR system')} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title={t('Total Employees')} value={stats.totalEmployees} icon={Users} index={0} />
        <StatsCard title={t('Departments')} value={stats.totalDepartments} icon={Building2} index={1} />
        <StatsCard title={t('Pending Leaves')} value={stats.pendingLeaves} icon={CalendarClock} index={2} />
        <StatsCard title={t("Today's Attendance")} value={stats.todayAttendance} icon={ClipboardCheck} index={3} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LeaveChart data={stats.leaveTrend} />
        <AttendanceChart data={stats.attendanceTrend} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Department headcount */}
        <Card className="lg:col-span-1">          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('Department Headcount')}</CardTitle>
            <CardDescription>{t('Active employees per department')}</CardDescription>
          </CardHeader>
          <CardContent>
            {headcount && headcount.byDepartment.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...headcount.byDepartment, ...(headcount.unassigned > 0 ? [{ name: 'Unassigned', count: headcount.unassigned }] : [])]} barSize={22}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" className="chart-grad-a" />
                      <stop offset="100%" className="chart-grad-b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('No data')}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">{t('Recent Activity')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity && activity.length > 0 ? (
                activity.slice(0, 8).map((item, i) => {
                  const Icon = activityIcon(item.type);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-3"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">{item.message}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.at)}</p>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">{t('No recent activity')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming birthdays & anniversaries */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cake className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">{t('Upcoming Events')}</CardTitle>
              <Badge variant="secondary" className="ml-auto text-xs">{t('Next 30 days')}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcoming?.birthdays && upcoming.birthdays.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('Birthdays')}</p>
                  <div className="space-y-2">
                    {upcoming.birthdays.slice(0, 4).map((b) => (
                      <div key={b.id} className="flex items-center gap-2">
                        <Cake className="h-3.5 w-3.5 shrink-0 text-pink-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(b.date)}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{b.daysUntil}d</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {upcoming?.anniversaries && upcoming.anniversaries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('Anniversaries')}</p>
                  <div className="space-y-2">
                    {upcoming.anniversaries.slice(0, 4).map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <Award className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.years} {t('yr(s)')}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{a.daysUntil}d</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!upcoming?.birthdays?.length && !upcoming?.anniversaries?.length) && (
                <p className="text-sm text-muted-foreground">{t('No upcoming events')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeaveCalendarWidget />
        <OrgChartCard />
      </div>
    </div>
  );
}
