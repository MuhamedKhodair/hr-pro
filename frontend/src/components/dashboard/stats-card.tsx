'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCounter } from './animated-counter';

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  description?: string;
  index: number;
}

export function StatsCard({ title, value, icon: Icon, description, index }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
    >
      <Card className="group overflow-hidden transition-all hover:border-ring/50 hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <p className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
            </div>
            <div className="mt-2 font-display text-[30px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
              <AnimatedCounter value={value} />
            </div>
            {description && <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
            <Icon className="h-[18px] w-[18px] text-primary" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
