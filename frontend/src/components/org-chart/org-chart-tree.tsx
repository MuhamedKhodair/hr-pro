'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrgNode {
  id: string;
  name: string;
  position: string;
  reportsToId: string | null;
  department: { name: string } | null;
  children: OrgNode[];
}

function NodeCard({ node, depth, hasChildren, isCollapsed, onToggle }: {
  node: OrgNode;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(depth * 0.06, 0.6) }}
      className="relative w-44"
    >
      <div
        className={cn(
          'rounded-lg border bg-card p-3 text-center shadow-sm transition-colors hover:border-primary/40',
          depth === 0 ? 'border-primary/50 bg-primary/[0.04]' : 'border-border',
        )}
      >
        {hasChildren && (
          <button
            onClick={() => onToggle(node.id)}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            className="absolute -end-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', isCollapsed && '-rotate-90')} strokeWidth={2.5} />
          </button>
        )}
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {node.name.charAt(0).toUpperCase()}
        </div>
        <p className="mt-1.5 truncate text-sm font-medium text-foreground">{node.name}</p>
        <p className="truncate text-xs text-muted-foreground">{node.position}</p>
        {node.department && (
          <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {node.department.name}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function TreeNode({ node, depth, onToggle, collapsed }: {
  node: OrgNode;
  depth: number;
  onToggle: (id: string) => void;
  collapsed: Record<string, boolean>;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed[node.id];

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        node={node}
        depth={depth}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
      />
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center">
          <div className="h-4 w-px bg-border" />
          <div className="flex items-start">
            {node.children.map((child, idx) => {
              const first = idx === 0;
              const last = idx === node.children.length - 1;
              const single = node.children.length === 1;
              return (
                <div key={child.id} className="relative flex flex-1 flex-col items-center px-1">
                  {!single && (
                    <div
                      className="absolute top-0 h-px bg-border"
                      style={
                        first
                          ? { left: '50%', right: 0 }
                          : last
                            ? { left: 0, right: '50%' }
                            : { left: 0, right: 0 }
                      }
                    />
                  )}
                  <div className="h-4 w-px bg-border" />
                  <TreeNode node={child} depth={depth + 1} onToggle={onToggle} collapsed={collapsed} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function countNodes(nodes: OrgNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}
