'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Network, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/tables/data-table';
import { useApiGet } from '@/hooks/useApi';
import { countNodes, TreeNode, type OrgNode } from './org-chart-tree';
import { useTranslation } from '@/lib/i18n';

export function OrgChartModal({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { data: tree } = useApiGet<OrgNode[]>(['org-chart'], '/employees/org-chart');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={t('Org Chart')}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-3 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:inset-6 lg:inset-10"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Network className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-[15px] font-semibold leading-tight tracking-tight">{t('Org Chart')}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t('Reporting structure')}</p>
                </div>
                {tree && (
                  <Badge variant="secondary" className="ms-1 hidden sm:inline-flex">
                    {countNodes(tree)} {t('employees')}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('Close')}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto bg-background">
              {!tree || tree.length === 0 ? (
                <EmptyState
                  icon={Network}
                  title={t('No reporting structure')}
                  description={t('Assign managers to employees to build the chart.')}
                />
              ) : (
                <div className="flex min-w-max items-start justify-center gap-8 p-8">
                  {tree.map((node) => (
                    <TreeNode key={node.id} node={node} depth={0} onToggle={toggle} collapsed={collapsed} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
