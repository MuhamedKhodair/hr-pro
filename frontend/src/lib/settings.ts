'use client';

import { api } from './api';
import { useEffect, useState } from 'react';

export interface CompanySettings {
  id: string;
  companyName: string;
  companyTagline: string;
  logoPath: string;
  primaryColor: string;
  annualLeaveEntitlement?: number;
  sickLeaveEntitlement?: number;
  vacationMaxDaysPerRequest?: number;
  sickMaxDaysPerRequest?: number;
  unpaidMaxDaysPerRequest?: number;
  currency: string;
  currencySymbol: string;
  fiscalYearStartMonth: number;
  workingDays: string[];
  weekStartsOn: string;
  lateThresholdMinutes?: number;
  standardWorkHours?: number;
  overtimeRateMultiplier?: number;
  allowPublicRegistration?: boolean;
  registrationWhitelist?: string;
  updatedAt?: string;
}

const CACHE_KEY = 'company-settings';
const CHANGE_EVENT = 'hr-pro:settings-changed';
let cached: CompanySettings | null = null;

export function getCachedSettings(): CompanySettings | null {
  if (cached) return cached;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.workingDays)) {
        cached = parsed as CompanySettings;
        return cached;
      }
      cached = null;
    }
  } catch {
    cached = null;
  }
  return cached;
}

export function setCachedSettings(settings: CompanySettings) {
  cached = settings;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
    } catch {
      /* ignore quota errors */
    }
  }
}

export function applyBrand(settings: CompanySettings) {
  if (typeof document === 'undefined') return;
  if (settings.primaryColor) {
    document.documentElement.style.setProperty('--primary', settings.primaryColor);
  }
  document.title = settings.companyName ? `${settings.companyName} | HR Pro` : 'HR Pro';
}

export function useCompanySettings(): CompanySettings | null {
  const [settings, setSettings] = useState<CompanySettings | null>(() => getCachedSettings());
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<CompanySettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);
  return settings;
}

export async function fetchSettings(): Promise<CompanySettings> {
  const res = await api.get<CompanySettings>('/settings');
  if (res.data) setCachedSettings(res.data);
  return res.data!;
}

export const DAY_OPTIONS = [
  { value: 'Mon', label: 'Monday' },
  { value: 'Tue', label: 'Tuesday' },
  { value: 'Wed', label: 'Wednesday' },
  { value: 'Thu', label: 'Thursday' },
  { value: 'Fri', label: 'Friday' },
  { value: 'Sat', label: 'Saturday' },
  { value: 'Sun', label: 'Sunday' },
] as const;
