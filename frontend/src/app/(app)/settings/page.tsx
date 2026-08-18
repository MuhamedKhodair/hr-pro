'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useRequireRole } from '@/hooks/useRequireRole';

import { Settings as SettingsIcon, Loader2, Users, KeyRound, Plus, Trash2, CalendarDays, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { CompanySettings, DAY_OPTIONS, setCachedSettings, applyBrand } from '@/lib/settings';
import { assetUrl } from '@/lib/api';
import { Palette, Upload } from 'lucide-react';

interface UserAccount {
  id: string;
  email: string;
  role: 'Admin' | 'HR' | 'Employee';
  employeeId: string | null;
  createdAt: string;
  employee: { id: string; name: string; position: string } | null;
}

interface EmployeeOption {
  id: string;
  name: string;
  position: string | null;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
}

const ROLE_STYLES: Record<string, string> = {
  Admin: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  HR: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  Employee: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const BRAND_PRESETS = ['#4756d7', '#2563eb', '#0f766e', '#15803d', '#b45309', '#c2410c', '#be185d', '#7c3aed'];

export default function SettingsPage() {
  useRequireRole(['Admin']);
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'Employee' as UserAccount['role'], employeeId: '' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '' });
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [form, setForm] = useState<CompanySettings>({
    id: 'singleton',
    companyName: 'HR Pro',
    companyTagline: '',
    logoPath: '',
    primaryColor: '#4756d7',
    annualLeaveEntitlement: 21,
    sickLeaveEntitlement: 15,
    vacationMaxDaysPerRequest: 21,
    sickMaxDaysPerRequest: 15,
    unpaidMaxDaysPerRequest: 30,
    currency: 'USD',
    currencySymbol: '$',
    fiscalYearStartMonth: 1,
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    weekStartsOn: 'Mon',
    allowPublicRegistration: false,
    registrationWhitelist: '',
  });

  useEffect(() => {
    api
      .get<CompanySettings>('/settings')
      .then((res) => {
        if (res.data) {
          const s = res.data;
          setForm({
            ...form,
            ...s,
            workingDays: Array.isArray(s.workingDays) ? s.workingDays : String(s.workingDays).split(','),
          });
        }
      })
      .catch(() => addToast(t('Failed to load settings.'), 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = () => {
    setUsersLoading(true);
    Promise.all([
      api.get<UserAccount[]>('/users'),
      api.get<{ data: EmployeeOption[] }>('/employees?pageSize=100'),
    ])
      .then(([u, e]) => {
        setUsers(u.data ?? []);
        const list = e.data?.data ?? [];
        setEmployees(list.filter((emp) => !u.data?.some((usr) => usr.employeeId === emp.id)));
      })
      .catch(() => addToast(t('Failed to load user accounts.'), 'error'))
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHolidays = () => {
    api
      .get<Holiday[]>('/holidays')
      .then((res) => setHolidays(res.data ?? []))
      .catch(() => addToast(t('Failed to load holidays.'), 'error'))
      .finally(() => setHolidaysLoading(false));
  };

  useEffect(() => {
    loadHolidays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddHoliday = async () => {
    if (!holidayForm.name || !holidayForm.date) return;
    setAddingHoliday(true);
    try {
      await api.post('/holidays', holidayForm);
      addToast(t('Holiday added'), 'success');
      setShowAddHoliday(false);
      setHolidayForm({ name: '', date: '' });
      loadHolidays();
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (h: Holiday) => {
    try {
      await api.delete(`/holidays/${h.id}`);
      addToast(t('Holiday deleted'), 'success');
      loadHolidays();
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || createForm.password.length < 6) {
      addToast(t('Password must be at least 6 characters.'), 'error');
      return;
    }
    setCreatingUser(true);
    try {
      await api.post('/users', {
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        employeeId: createForm.employeeId || undefined,
      });
      addToast(t('User account created'), 'success');
      setShowCreateUser(false);
      setCreateForm({ email: '', password: '', role: 'Employee', employeeId: '' });
      loadUsers();
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) return;
    setResetting(true);
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { password: newPassword });
      addToast(t('Password reset'), 'success');
      setResetTarget(null);
      setNewPassword('');
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteUser = async (u: UserAccount) => {
    try {
      await api.delete(`/users/${u.id}`);
      addToast(t('User account deleted'), 'success');
      loadUsers();
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    }
  };

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      workingDays: f.workingDays.includes(day)
        ? f.workingDays.filter((d) => d !== day)
        : [...f.workingDays, day],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put<CompanySettings>('/settings', {
        companyName: form.companyName,
        companyTagline: form.companyTagline,
        logoPath: form.logoPath,
        primaryColor: form.primaryColor,
        annualLeaveEntitlement: Number(form.annualLeaveEntitlement),
        sickLeaveEntitlement: Number(form.sickLeaveEntitlement),
        vacationMaxDaysPerRequest: Number(form.vacationMaxDaysPerRequest),
        sickMaxDaysPerRequest: Number(form.sickMaxDaysPerRequest),
        unpaidMaxDaysPerRequest: Number(form.unpaidMaxDaysPerRequest),
        currency: form.currency,
        currencySymbol: form.currencySymbol,
        fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
        workingDays: form.workingDays,
        weekStartsOn: form.weekStartsOn,
        allowPublicRegistration: form.allowPublicRegistration ?? false,
        registrationWhitelist: form.registrationWhitelist ?? '',
      });
      if (res.data) {
        setCachedSettings(res.data);
        applyBrand(res.data);
      }
      addToast(t('Settings saved'), 'success');
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await api.upload<CompanySettings>('/uploads/logo', file);
      if (res.data) {
        setForm((f) => ({ ...f, logoPath: res.data!.logoPath }));
        setCachedSettings(res.data);
      }
      addToast(t('Logo uploaded'), 'success');
    } catch (err: any) {
      addToast(err.message || t('Error'), 'error');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('Settings')}</h1>
        <p className="text-muted-foreground">{t('Company information and regional preferences')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> {t('Company Information')}
          </CardTitle>
          <CardDescription>{t('Used across reports, payslips and the dashboard')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('Company Name')}</Label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Tagline')}</Label>
            <Input
              value={form.companyTagline}
              onChange={(e) => setForm({ ...form, companyTagline: e.target.value })}
              placeholder={t('Human Resources')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> {t('Regional Settings')}
          </CardTitle>
          <CardDescription>{t('Currency and fiscal period used in payroll')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('Currency Code')}</Label>
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="USD"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Currency Symbol')}</Label>
            <Input
              value={form.currencySymbol}
              onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
              placeholder="$"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Fiscal Year Starts')}</Label>
            <Select
              value={String(form.fiscalYearStartMonth)}
              onChange={(e) => setForm({ ...form, fiscalYearStartMonth: Number(e.target.value) })}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Week Starts On')}</Label>
            <Select
              value={form.weekStartsOn}
              onChange={(e) => setForm({ ...form, weekStartsOn: e.target.value })}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{t(d.label)}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Annual Leave Entitlement (days)')}</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.annualLeaveEntitlement}
              onChange={(e) => setForm({ ...form, annualLeaveEntitlement: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Sick Leave Entitlement (days)')}</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.sickLeaveEntitlement}
              onChange={(e) => setForm({ ...form, sickLeaveEntitlement: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Vacation Max Days Per Request')}</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.vacationMaxDaysPerRequest}
              onChange={(e) => setForm({ ...form, vacationMaxDaysPerRequest: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Sick Max Days Per Request')}</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.sickMaxDaysPerRequest}
              onChange={(e) => setForm({ ...form, sickMaxDaysPerRequest: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Unpaid Max Days Per Request')}</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.unpaidMaxDaysPerRequest}
              onChange={(e) => setForm({ ...form, unpaidMaxDaysPerRequest: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" /> {t('Branding & Identity')}
          </CardTitle>
          <CardDescription>{t('Logo and brand color shown in the sidebar, login screen and reports')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            {form.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(form.logoPath)} alt="logo" className="h-14 w-14 rounded-xl border border-border object-contain bg-white p-1" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <SettingsIcon className="h-6 w-6" />
              </div>
            )}
            <div className="space-y-1">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={uploadingLogo}
                onClick={() => document.getElementById('logo-input')?.click()}
              >
                {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('Upload Logo')}
              </Button>
              <input
                id="logo-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <p className="text-xs text-muted-foreground">PNG, JPG or WebP &middot; max 2 MB</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>{t('Brand Color')}</Label>
            <div className="flex flex-wrap items-center gap-3">
              {BRAND_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, primaryColor: c })}
                  className={`h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                    form.primaryColor.toLowerCase() === c ? 'border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                {form.primaryColor.toUpperCase()}
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{t('Preview')}</span>
              <span
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: form.primaryColor }}
              >
                {form.companyName || 'HR Pro'}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('Save')}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Working Days')}</CardTitle>
          <CardDescription>{t('Days considered as business days for leave calculations')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => {
              const active = form.workingDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t(d.label)}
                </button>
              );
            })}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('Save')}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> {t('Public Holidays')}
            </CardTitle>
            <CardDescription>{t('Days excluded from leave calculations')}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAddHoliday(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t('Add Holiday')}
          </Button>
        </CardHeader>
        <CardContent>
          {holidaysLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : holidays.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('No holidays yet')}</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{h.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{new Date(h.date).toISOString().split('T')[0]}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 text-destructive" onClick={() => handleDeleteHoliday(h)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> {t('Users & Access')}
            </CardTitle>
            <CardDescription>{t('Manage who can sign in and what they can access')}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreateUser(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t('New User')}
          </Button>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('No user accounts yet')}</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.employee ? u.employee.name : t('No linked employee')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className={ROLE_STYLES[u.role]}>{u.role}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => { setResetTarget(u); setNewPassword(''); }}>
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteUser(u)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> {t('Self-Registration')}
            </CardTitle>
            <CardDescription>{t('Let employees create their own login from the sign-in page')}</CardDescription>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, allowPublicRegistration: !f.allowPublicRegistration }))}
            className={`relative h-6 w-11 rounded-full transition-colors ${form.allowPublicRegistration ? 'bg-primary' : 'bg-input'}`}
            aria-pressed={form.allowPublicRegistration}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                form.allowPublicRegistration ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.allowPublicRegistration ? (
            <>
              <p className="text-xs text-muted-foreground">
                {t('Only emails matching the whitelist can register, and only when they belong to an active employee.')}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="reg-whitelist">{t('Allowed emails / domains')}</Label>
                <Textarea
                  id="reg-whitelist"
                  value={form.registrationWhitelist ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, registrationWhitelist: e.target.value }))}
                  rows={3}
                  placeholder="@company.com\nname@company.com"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('Disabled — only administrators can create accounts.')}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogHeader>
          <DialogTitle>{t('New User')}</DialogTitle>
          <DialogDescription>{t('Create a login account and link it to an employee')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{t('Email')}</Label>
            <Input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="name@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Temporary Password')}</Label>
            <Input
              type="text"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="min 6 characters"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Role')}</Label>
            <Select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserAccount['role'] })}
            >
              <option value="Employee">Employee</option>
              <option value="HR">HR</option>
              <option value="Admin">Admin</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Link to Employee')}</Label>
            <Select
              value={createForm.employeeId}
              onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
            >
              <option value="">{t('None')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreateUser(false)}>{t('Cancel')}</Button>
          <Button onClick={handleCreateUser} disabled={creatingUser}>
            {creatingUser && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('Create')}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogHeader>
          <DialogTitle>{t('Reset Password')}</DialogTitle>
          <DialogDescription>
            {resetTarget ? `${resetTarget.email} · ${t('The user will need this new password to sign in')}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{t('New Password')}</Label>
          <Input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="min 6 characters"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setResetTarget(null)}>{t('Cancel')}</Button>
          <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6}>
            {resetting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('Reset')}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
        <DialogHeader>
          <DialogTitle>{t('Add Holiday')}</DialogTitle>
          <DialogDescription>{t('Days excluded from leave calculations')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{t('Holiday name')}</Label>
            <Input
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              placeholder="New Year"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Date')}</Label>
            <Input
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddHoliday(false)}>{t('Cancel')}</Button>
          <Button onClick={handleAddHoliday} disabled={addingHoliday || !holidayForm.name || !holidayForm.date}>
            {addingHoliday && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('Create')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

