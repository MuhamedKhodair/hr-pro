'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push('/login');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  return <>{children}</>;
}
