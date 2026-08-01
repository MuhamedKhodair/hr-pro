'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { DollarSign, Users, Gift, Wallet, TrendingUp, Building2, ArrowRight, Plus, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useApiGet } from '@/hooks/useApi';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface DeptBreakdown {
  name: string;
  total: number;
  baseTotal: number;
  count: number;
}

interface PayrollSummary {
  totalPayroll: number;
  totalBaseSalary: number;
  totalDeductions: number;
  totalIncentives: number;
  totalBonuses: number;
  avgSalary: number;
  employeeCount: number;
  finishedCount: number;
  draftCount: number;
  deptBreakdown: DeptBreakdown[];
}

interface TrendItem {
  month: string;
  totalPayroll: number;
  employeeCount: number;
  avgSalary: number;
  totalBase: number;
}

function StatsCard({ title, value, icon: Icon, description, index }: {
  title: string; value: number; icon: any; description?: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className="group hover:shadow-md transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              <AnimatedCounter value={value} prefix="$" />
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function SalaryDashboardPage() {
  const { t } = useTranslation();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: summary, isLoading } = useApiGet<PayrollSummary>(
    ['salary-summary', String(month), String(year)],
    `/salary/payroll/summary?month=${month}&year=${year}`,
  );

  const { data: trend } = useApiGet<TrendItem[]>(['salary-trend'], '/salary/payroll/trend');

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('Salary Management')}</h1>
          <p className="text-muted-foreground">{t('Payroll overview and administration')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="w-28">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
            ))}
          </Select>
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title={t('Total Payroll')} value={summary?.totalPayroll || 0} icon={DollarSign} index={0}
          description={`${summary?.employeeCount || 0} ${t('employees')}`} />
        <StatsCard title={t('Average Salary')} value={summary?.avgSalary || 0} icon={Wallet} index={1} />
        <StatsCard title={t('Total Incentives')} value={summary?.totalIncentives || 0} icon={Gift} index={2} />
        <StatsCard title={t('Total Bonuses')} value={summary?.totalBonuses || 0} icon={TrendingUp} index={3} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('Department Cost Breakdown')}</CardTitle>
            <CardDescription>{t('Payroll cost per department for')} {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary?.deptBreakdown && summary.deptBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={summary.deptBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('No payroll data for this month')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Monthly Payroll Trend')}</CardTitle>
            <CardDescription>Total payroll over time (finalized records)</CardDescription>
          </CardHeader>
          <CardContent>
            {trend && trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="totalPayroll" stroke="hsl(var(--primary))" name="Total Payroll" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="avgSalary" stroke="hsl(var(--chart-2))" name="Avg Salary" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No trend data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Link href="/salary/structures">
            <Card className="group cursor-pointer hover:shadow-md transition-all">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Salary Structures</p>
                    <p className="text-xs text-muted-foreground">Manage base salaries</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Link href="/salary/payroll">
            <Card className="group cursor-pointer hover:shadow-md transition-all">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Payroll Records</p>
                    <p className="text-xs text-muted-foreground">Generate & manage payroll</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Link href="/salary/structures">
            <Card className="group cursor-pointer hover:shadow-md transition-all">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Incentives & Bonuses</p>
                    <p className="text-xs text-muted-foreground">Manage components</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
