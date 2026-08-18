'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { markPasswordChanged, getHomePath } from '@/lib/auth';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) {
      addToast(t('New password must be at least 6 characters.'), 'error');
      return;
    }
    if (next !== confirm) {
      addToast(t('Passwords do not match.'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/me/password', { currentPassword: current, newPassword: next });
      markPasswordChanged();
      addToast(t('Password updated'), 'success');
      router.push(getHomePath());
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> {t('Change Password')}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {t('You must set a new password before continuing.')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('Current Password')}</Label>
              <Input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('New Password')}</Label>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('Confirm New Password')}</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('Change Password')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
