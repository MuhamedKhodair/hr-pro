'use client';

import { Maximize2, Network } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useApiGet } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { countNodes, type OrgNode } from '@/components/org-chart/org-chart-tree';
import { useOrgChart } from '@/components/org-chart/org-chart-provider';

function MiniNode({ node, isRoot }: { node: OrgNode; isRoot?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={
          isRoot
            ? 'w-40 rounded-lg border border-primary/50 bg-primary/[0.04] p-2.5 text-center shadow-sm'
            : 'w-36 rounded-lg border border-border bg-card p-2 text-center shadow-sm'
        }
      >
        <div
          className={
            isRoot
              ? 'mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white'
              : 'mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary'
          }
        >
          {node.name.charAt(0).toUpperCase()}
        </div>
        <p className="mt-1 truncate text-xs font-medium text-foreground">{node.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{node.position}</p>
      </div>
      {node.children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="h-3 w-px bg-border" />
          <div className="flex items-start">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center px-0.5">
                <div className="h-3 w-px bg-border" />
                <MiniNode node={child} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function OrgChartCard() {
  const { t } = useTranslation();
  const { openOrgChart } = useOrgChart();
  const { data: tree, isLoading } = useApiGet<OrgNode[]>(['org-chart'], '/employees/org-chart');

  return (
    <Card
      onClick={openOrgChart}
      className="cursor-pointer transition-all hover:border-ring/50 hover:shadow-md"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openOrgChart();
        }
      }}
    >
        <CardHeader>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{t('Reporting Structure')}</CardTitle>
            {tree && <Badge variant="secondary" className="ml-auto text-xs">{countNodes(tree)} {t('employees')}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-36 w-full" />
          ) : !tree || tree.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('No reporting structure')}</p>
          ) : (
            <>
              <div className="overflow-hidden">
                <div className="flex min-w-max items-start justify-center gap-8 pb-2">
                  {tree.map((node) => (
                    <MiniNode key={node.id} node={node} isRoot />
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-border pt-3 text-xs font-medium text-primary">
                <Maximize2 className="h-3.5 w-3.5" />
                {t('Open full screen')}
              </div>
            </>
          )}
        </CardContent>
      </Card>
  );
}
