'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { AuthGuard } from '@/components/layout/auth-guard';
import { TopNav } from '@/components/layout/top-nav';
import { SettingsSync } from '@/components/layout/settings-sync';
import { OrgChartProvider } from '@/components/org-chart/org-chart-provider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <OrgChartProvider>
        <SettingsSync />
        <div className="relative flex min-h-screen">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopNav onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </OrgChartProvider>
    </AuthGuard>
  );
}
