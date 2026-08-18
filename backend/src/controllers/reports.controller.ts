import { Request, Response, NextFunction } from 'express';
import * as reportsService from '../services/reports.service';

function parseMonthYear(req: Request): { month: number; year: number } {
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const year = Number(req.query.year ?? new Date().getFullYear());
  const m = Number.isFinite(month) ? Math.min(Math.max(Math.floor(month), 1), 12) : new Date().getMonth() + 1;
  const y = Number.isFinite(year) ? Math.floor(year) : new Date().getFullYear();
  return { month: m, year: y };
}

export async function leaveSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = parseMonthYear(req);
    const summary = await reportsService.leaveSummary(month, year);
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="leave-summary-${year}-${String(month).padStart(2, '0')}.csv"`);
      return res.send(reportsService.leaveSummaryCsv(summary));
    }
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

export async function attendanceSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = parseMonthYear(req);
    const summary = await reportsService.attendanceSummary(month, year);
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-summary-${year}-${String(month).padStart(2, '0')}.csv"`);
      return res.send(reportsService.attendanceSummaryCsv(summary));
    }
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

export async function headcount(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportsService.headcountReport();
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="headcount.csv"');
      return res.send(reportsService.headcountCsv(report));
    }
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}