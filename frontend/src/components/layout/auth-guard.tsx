'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, setUser } from '@/lib/auth';
import { api } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.mustChangePassword && pathname !== '/change-password') {
      router.push('/change-password');
      return;
    }
    setChecked(true);
    api.get<{ email: string; id: string; role: string }>('/auth/me').then((res) => {
      const server = res.data;
      const cached = getUser();
      if (server && cached && server.email !== cached.email) {
        setUser({ ...cached, ...server });
        router.refresh();
      }
    });
  }, [router, pathname]);

  if (!checked) return null;

  return <>{children}</>;
}
