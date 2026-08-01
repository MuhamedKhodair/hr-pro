'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#6366f1', '#10b981', '#f59e0b'];

interface LeaveChartProps {
  data: { status: string; _count: number }[];
}

export function LeaveChart({ data }: LeaveChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({ name: d.status, value: d._count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Leave Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
