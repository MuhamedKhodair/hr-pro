'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginSchema } from '@/lib/validations';
import { login, twoFactorLogin, getHomePath } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { fetchSettings } from '@/lib/settings';
import { assetUrl } from '@/lib/api';
import { z } from 'zod';
import { useEffect } from 'react';

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifying2fa, setVerifying2fa] = useState(false);
  const [brand, setBrand] = useState<{ companyName: string; logoPath: string; companyTagline: string; allowPublicRegistration: boolean }>({
    companyName: 'HR Pro',
    logoPath: '',
    companyTagline: 'Management System',
    allowPublicRegistration: false,
  });

  useEffect(() => {
    fetchSettings()
      .then((s) => setBrand({ companyName: s.companyName, logoPath: s.logoPath, companyTagline: s.companyTagline, allowPublicRegistration: !!s.allowPublicRegistration }))
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const fillDemo = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const result = await login(data);
      if (result?.needsTwoFactor && result.twoFactorToken) {
        setTwoFactorToken(result.twoFactorToken);
        return;
      }
      await queryClient.clear();
      addToast('Login successful!', 'success');
      router.push(getHomePath(result));
    } catch (err: any) {
      addToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitTwoFactor = async () => {
    if (!twoFactorToken) return;
    setVerifying2fa(true);
    try {
      await twoFactorLogin(twoFactorToken, twoFactorCode);
      await queryClient.clear();
      addToast('Login successful!', 'success');
      router.push(getHomePath());
    } catch (err: any) {
      addToast(err.message || 'Verification failed', 'error');
    } finally {
      setVerifying2fa(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-[#0e1420] p-10 lg:flex">
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative flex items-center gap-3">
          {brand.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(brand.logoPath)}
              alt={brand.companyName}
              className="h-10 w-10 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_1px_3px_color-mix(in_srgb,var(--primary)_50%,transparent)]">
              <Building className="h-5 w-5" strokeWidth={2.25} />
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[17px] font-bold tracking-tight text-white">{brand.companyName}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{brand.companyTagline || t('Management System')}</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">People Operations</p>
          <h1 className="mt-3 font-display text-[34px] font-semibold leading-[1.15] tracking-tight text-white">
            One control room for your workforce.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-white/55">
            Employees, attendance, leave, payroll and audit — managed from a single, precise console.
          </p>
        </div>

        <div className="relative flex items-center gap-6 font-mono text-[11px] uppercase tracking-wider text-white/35">
          <span>18 employees</span>
          <span className="h-3 w-px bg-white/15" />
          <span>5 departments</span>
          <span className="h-3 w-px bg-white/15" />
          <span>Full audit trail</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative w-full max-w-sm"
        >
          <div className="rounded-xl border border-border bg-card p-8 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_24px_rgba(16,24,40,0.06)]">
            <div className="mb-8 flex flex-col items-center lg:hidden">
              {brand.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={assetUrl(brand.logoPath)}
                  alt={brand.companyName}
                  className="h-12 w-12 rounded-xl object-contain"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Building className="h-6 w-6" strokeWidth={2.25} />
                </div>
              )}
              <h1 className="mt-4 font-display text-[24px] font-semibold tracking-tight">{brand.companyName}</h1>
            </div>
            <div className="mb-8 hidden lg:block">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('Sign in to your account')}</p>
              <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tight">{t('Welcome back')}</h1>
            </div>

          {twoFactorToken ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-5 text-center">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <p className="text-sm font-semibold">{t('Two-factor authentication')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('Enter the 6-digit code from your authenticator app, or a backup code.')}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="2fa-code">{t('Verification code')}</Label>
                <Input
                  id="2fa-code"
                  inputMode="numeric"
                  autoFocus
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitTwoFactor()}
                />
              </div>
              <Button className="w-full" size="lg" onClick={submitTwoFactor} disabled={verifying2fa || !twoFactorCode}>
                {verifying2fa && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying2fa ? t('Verifying...') : t('Verify & Sign In')}
              </Button>
              <button
                onClick={() => setTwoFactorToken(null)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {t('Back to sign in')}
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('Email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t('Password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...register('password')}
                  className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : t('Sign In')}
            </Button>
          </form>
          )}

          <div className="mt-6 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
            <p className="mb-2 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t('Demo accounts — tap to fill')}
            </p>
            <div className="space-y-1.5">
              {([
                ['Admin', 'alice@hrpro.com', 'admin123'],
                ['HR', 'bob@hrpro.com', 'admin123'],
                ['Employee', 'charlie@hrpro.com', 'admin123'],
                ['Employee', 'diana@hrpro.com', 'admin123'],
              ] as const).map(([role, email, password]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => fillDemo(email, password)}
                  className="flex w-full items-center justify-between rounded-md border border-border/70 bg-card px-3 py-1.5 text-start transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {t(role)}
                    </span>
                    <span className="font-mono text-[11px] text-foreground/80">{email}</span>
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{password}</span>
                </button>
              ))}
            </div>
          </div>

          {!twoFactorToken && brand.allowPublicRegistration && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t("Don't have an account?")}{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                {t('Create your account')}
              </Link>
            </p>
          )}
        </div>
        </motion.div>
      </div>
    </div>
  );
}
