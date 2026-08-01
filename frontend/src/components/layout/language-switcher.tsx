'use client';

import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
      className="h-8 w-8"
      title={locale === 'en' ? 'العربية' : 'English'}
    >
      <Languages className="h-4 w-4" />
    </Button>
  );
}
