'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useApiGet } from '@/hooks/useApi';
import { Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/tables/data-table';
import { countNodes, TreeNode, type OrgNode } from '@/components/org-chart/org-chart-tree';
import { useOrgChart } from '@/components/org-chart/org-chart-provider';

export default function OrgChartPage() {
  const { t } = useTranslation();
  const { openOrgChart } = useOrgChart();
  const { data: tree, isLoading, error, refetch } = useApiGet<OrgNode[]>(['org-chart'], '/employees/org-chart');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    openOrgChart();
  }, [openOrgChart]);

  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">HR Pro / {t('Org Chart')}</p>
          <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight">{t('Org Chart')}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('Reporting structure')}</p>
        </div>
        {tree && <Badge variant="secondary">{countNodes(tree)} {t('employees')}</Badge>}
      </div>

      {!tree || tree.length === 0 ? (
        <EmptyState icon={Network} title={t('No reporting structure')} description={t('Assign managers to employees to build the chart.')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex min-w-max items-start justify-center gap-8">
            {tree.map((node) => (
              <TreeNode key={node.id} node={node} depth={0} onToggle={toggle} collapsed={collapsed} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
