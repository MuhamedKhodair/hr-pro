import { getUser } from './auth';

export type UserRole = 'Admin' | 'HR' | 'Employee';

export function hasRole(...roles: UserRole[]): boolean {
  const user = getUser();
  if (!user) return false;
  return roles.includes(user.role as UserRole);
}

export function isAdminOrHr(): boolean {
  return hasRole('Admin', 'HR');
}
