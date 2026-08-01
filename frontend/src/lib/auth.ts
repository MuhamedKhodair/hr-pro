'use client';

import { api } from './api';

type UserRole = 'Admin' | 'HR' | 'Employee';

interface LoginData {
  email: string;
  password: string;
}

interface AuthResponse {
  user: { id: string; email: string; role: string; employeeId: string | null };
  accessToken: string;
  refreshToken: string;
}

export async function login(data: LoginData) {
  const res = await api.post<AuthResponse>('/auth/login', data);
  if (res.data) {
    localStorage.setItem('token', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.data.user));
  }
  return res.data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function isAdminOrHr(): boolean {
  const user = getUser();
  if (!user) return false;
  return user.role === 'Admin' || user.role === 'HR';
}
