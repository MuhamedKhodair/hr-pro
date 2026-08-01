'use client';

import { useTranslation } from '@/lib/i18n';
import { Users, Building2, CalendarClock, ClipboardCheck } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';
import { LeaveChart } from '@/components/dashboard/leave-chart';
import { AttendanceChart } from '@/components/dashboard/attendance-chart';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { useApiGet } from '@/hooks/useApi';

interface DashboardStats {
  totalEmployees: number;
  totalDepartments: number;
  pendingLeaves: number;
  todayAttendance: number;
  leaveTrend: { status: string; _count: number }[];
  attendanceTrend: { date: string; status: string }[];
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useApiGet<DashboardStats>(['dashboard'], '/dashboard/stats');

  if (isLoading) return <DashboardSkeleton />;
  if (!stats) return <p className="text-muted-foreground">{t('No data available.')}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('Dashboard')}</h1>
        <p className="text-muted-foreground">{t('Overview of your HR system')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title={t('Total Employees')} value={stats.totalEmployees} icon={Users} index={0} />
        <StatsCard title={t('Departments')} value={stats.totalDepartments} icon={Building2} index={1} />
        <StatsCard
          title={t('Pending Leaves')}
          value={stats.pendingLeaves}
          icon={CalendarClock}
          index={2}
        />
        <StatsCard
          title={t("Today's Attendance")}
          value={stats.todayAttendance}
          icon={ClipboardCheck}
          index={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LeaveChart data={stats.leaveTrend} />
        <AttendanceChart data={stats.attendanceTrend} />
      </div>
    </div>
  );
}
