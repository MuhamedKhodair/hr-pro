'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getHomePath } from '@/lib/auth';

export default function AppRoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getHomePath());
  }, [router]);
  return null;
}