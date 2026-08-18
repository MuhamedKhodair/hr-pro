import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  position: z.string().min(1, 'Position is required'),
  hireDate: z.string().min(1, 'Hire date is required'),
  birthDate: z.string().optional(),
  salary: z.coerce.number().positive('Salary must be positive'),
  status: z.enum(['Active', 'Inactive', 'Terminated']).optional(),
  reportsToId: z.string().optional(),
  shiftId: z.string().optional(),
});

export const departmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export const leaveSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  type: z.string().min(1, 'Leave type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
  halfDayStart: z.boolean().optional(),
  halfDayEnd: z.boolean().optional(),
  attachmentUrl: z.string().optional(),
});
