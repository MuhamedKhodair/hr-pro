'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { AuthGuard } from '@/components/layout/auth-guard';
import { TopNav } from '@/components/layout/top-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNav onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
