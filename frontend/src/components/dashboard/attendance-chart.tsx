'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
        <CardTitle className="text-lg">Attendance (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip />
              <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="HalfDay" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
