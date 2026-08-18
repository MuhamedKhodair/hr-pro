'use client';

import { useEffect } from 'react';
import { fetchSettings, applyBrand } from '@/lib/settings';

export function SettingsSync() {
  useEffect(() => {
    fetchSettings()
      .then(applyBrand)
      .catch(() => {
        /* keep defaults on failure */
      });
  }, []);

  return null;
}
