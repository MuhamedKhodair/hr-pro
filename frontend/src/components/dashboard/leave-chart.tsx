'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltip } from '@/components/dashboard/chart-tooltip';

const COLORS = ['#4756d7', '#10b981', '#f59e0b'];

interface LeaveChartProps {
  data: { status: string; _count: number }[];
}

export function LeaveChart({ data }: LeaveChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({ name: d.status, value: d._count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Leave Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={3}
                cornerRadius={4}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : COLORS[index % COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} verticalAlign="bottom" height={36} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                <tspan x="50%" dy="-4" fontSize="22" fontWeight={600} fill="var(--foreground)" style={{ fontFamily: 'var(--font-display-var), sans-serif' }}>
                  {chartData.reduce((s, d) => s + d.value, 0)}
                </tspan>
                <tspan x="50%" dy="16" fontSize="10" fill="var(--muted-foreground)" style={{ fontFamily: 'var(--font-mono-var), monospace' }}>
                  TOTAL
                </tspan>
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
