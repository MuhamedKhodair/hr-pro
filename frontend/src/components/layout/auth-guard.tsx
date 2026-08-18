'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push('/login');
    } else if (user.mustChangePassword && pathname !== '/change-password') {
      router.push('/change-password');
    } else {
      setChecked(true);
    }
  }, [router, pathname]);

  if (!checked) return null;

  return <>{children}</>;
}
