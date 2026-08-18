'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltip } from '@/components/dashboard/chart-tooltip';

interface AttendanceChartProps {
  data: { date: string; status: string }[];
}

export function AttendanceChart({ data }: AttendanceChartProps) {
  if (!data || data.length === 0) return null;

  const grouped: Record<string, { date: string; Present: number; Absent: number; HalfDay: number }> = {};

  data.forEach((item) => {
    const d = new Date(item.date);
    const day = `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
    if (!grouped[day]) grouped[day] = { date: day, Present: 0, Absent: 0, HalfDay: 0 };
    if (item.status === 'Present') grouped[day].Present++;
    else if (item.status === 'Absent') grouped[day].Absent++;
    else if (item.status === 'HalfDay') grouped[day].HalfDay++;
  });

  const chartData = Object.values(grouped);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Attendance (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} verticalAlign="top" height={32} />
              <Bar dataKey="Present" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Absent" fill="#f05454" radius={[3, 3, 0, 0]} />
              <Bar dataKey="HalfDay" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
