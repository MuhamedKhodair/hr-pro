'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, getHomePath } from '@/lib/auth';

export type AllowedRoles = ('Admin' | 'HR' | 'Employee')[];

/**
 * Client-side role guard for pages. Redirects unauthenticated users to /login
 * and users without the required role to their home page. Call as the first
 * hook (before any conditional return) inside the page component.
 */
export function useRequireRole(required: AllowedRoles) {
  const router = useRouter();
  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!required.includes(user.role)) {
      router.replace(getHomePath(user));
    }
  }, [required.join(','), router]);
}
