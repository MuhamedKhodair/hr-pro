'use client';

import { api } from './api';

type UserRole = 'Admin' | 'HR' | 'Employee';

interface LoginData {
  email: string;
  password: string;
}

interface AuthResponse {
  user: { id: string; email: string; role: string; employeeId: string | null; mustChangePassword?: boolean; twoFactorEnabled?: boolean };
  accessToken: string;
  refreshToken: string;
  needsTwoFactor?: boolean;
  twoFactorToken?: string;
}

export async function login(data: LoginData) {
  const res = await api.post<AuthResponse>('/auth/login', data);
  if (res.data?.user) {
    // Tokens live in HttpOnly cookies; only the user profile is cached here.
    localStorage.setItem('user', JSON.stringify(res.data.user));
  }
  return res.data;
}

export async function twoFactorLogin(twoFactorToken: string, code: string) {
  const res = await api.post<AuthResponse>('/auth/2fa/verify-login', { twoFactorToken, code });
  if (res.data?.user) {
    localStorage.setItem('user', JSON.stringify(res.data.user));
  }
  return res.data;
}

export function logout() {
  api
    .post('/auth/logout')
    .catch(() => undefined)
    .finally(() => clearSession());
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function markPasswordChanged() {
  const user = getUser();
  if (!user) return;
  user.mustChangePassword = false;
  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function isAdminOrHr(): boolean {
  const user = getUser();
  if (!user) return false;
  return user.role === 'Admin' || user.role === 'HR';
}

export function getHomePath(user = getUser()) {
  return user?.role === 'Employee' ? '/me' : '/dashboard';
}
