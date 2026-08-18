import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { z } from 'zod';

export const holidaySchema = z.object({
  name: z.string().min(1).max(120),
  date: z.string(),
});

export async function listHolidays() {
  return prisma.holiday.findMany({ orderBy: { date: 'asc' } });
}

export async function createHoliday(data: z.infer<typeof holidaySchema>) {
  const date = new Date(`${data.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new AppError(400, 'Invalid date');
  try {
    return await prisma.holiday.create({ data: { name: data.name, date } });
  } catch (err: any) {
    if (err?.code === 'P2002') throw new AppError(400, 'A holiday already exists for this date');
    throw err;
  }
}

export async function removeHoliday(id: string) {
  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Holiday not found');
  return prisma.holiday.delete({ where: { id } });
}
