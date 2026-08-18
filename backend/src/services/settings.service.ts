import prisma from '../lib/prisma';
import { z } from 'zod';

export const settingsSchema = z.object({
  companyName: z.string().min(1).max(120),
  companyTagline: z.string().max(200).optional().default(''),
  logoPath: z.string().max(300).optional().default(''),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .optional()
    .default('#4756d7'),
  annualLeaveEntitlement: z.coerce.number().min(0).max(365).optional().default(21),
  sickLeaveEntitlement: z.coerce.number().min(0).max(365).optional().default(15),
  vacationMaxDaysPerRequest: z.coerce.number().min(0).max(365).optional().default(21),
  sickMaxDaysPerRequest: z.coerce.number().min(0).max(365).optional().default(15),
  unpaidMaxDaysPerRequest: z.coerce.number().min(0).max(365).optional().default(30),
  currency: z.string().min(1).max(10),
  currencySymbol: z.string().min(1).max(5),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  workingDays: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])).min(1),
  weekStartsOn: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).default('Mon'),
  lateThresholdMinutes: z.coerce.number().int().min(0).max(240).optional().default(15),
  standardWorkHours: z.coerce.number().min(1).max(24).optional().default(8),
  overtimeRateMultiplier: z.coerce.number().min(1).max(4).optional().default(1.5),
  allowPublicRegistration: z.boolean().optional().default(false),
  registrationWhitelist: z.string().max(1000).optional().default(''),
});

const DEFAULT_SETTINGS = {
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
  workingDays: 'Mon,Tue,Wed,Thu,Fri',
  weekStartsOn: 'Mon',
  lateThresholdMinutes: 15,
  standardWorkHours: 8,
  overtimeRateMultiplier: 1.5,
  allowPublicRegistration: false,
  registrationWhitelist: '',
};

export async function getSettings() {
  const existing = await prisma.setting.findUnique({ where: { id: 'singleton' } });
  if (!existing) {
    return prisma.setting.create({ data: DEFAULT_SETTINGS });
  }
  return existing;
}

export async function updateSettings(data: z.infer<typeof settingsSchema>) {
  return prisma.setting.upsert({
    where: { id: 'singleton' },
    create: { ...DEFAULT_SETTINGS, ...data, workingDays: data.workingDays.join(',') },
    update: { ...data, workingDays: data.workingDays.join(',') },
  });
}
