import prisma from '../lib/prisma';
import { getSettings } from './settings.service';
import { AppError } from '../lib/errors';

export const LETTER_TYPES = ['employment', 'salary', 'leave'] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function money(n: number, symbol: string): string {
  return `${symbol}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export async function renderLetter(type: LetterType, employeeId: string): Promise<string> {
  const [settings, employee] = await Promise.all([
    getSettings(),
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        manager: { select: { name: true } },
        shift: { select: { name: true, startTime: true, endTime: true } },
        salaryStructures: { where: { effectiveTo: null }, take: 1 },
      },
    }),
  ]);
  if (!employee) throw new AppError(404, 'Employee not found');

  const symbol = settings.currencySymbol || settings.currency;
  const structure = employee.salaryStructures[0];
  const base = structure?.baseSalary ?? employee.salary;
  const today = new Date();
  const name = employee.name;
  const position = employee.position;
  const department = employee.department?.name ?? '—';
  const hireDate = fmtDate(employee.hireDate);
  const manager = employee.manager?.name ?? '—';
  const shift = employee.shift ? `${employee.shift.name} (${employee.shift.startTime}–${employee.shift.endTime})` : '—';
  const salary = money(base, symbol);
  const years = Math.max(0, Math.floor((today.getTime() - new Date(employee.hireDate).getTime()) / (365.25 * 86_400_000)));
  const todayStr = fmtDate(today);

  const company = esc(settings.companyName);
  const companyTagline = esc(settings.companyTagline);
  const logo = settings.logoPath;

  const body =
    type === 'employment'
      ? `
      <p>To Whom It May Concern,</p>
      <p>This is to certify that <strong>${esc(name)}</strong> is a full-time employee of <strong>${company}</strong>, employed in the position of <strong>${esc(position)}</strong>${department !== '—' ? ` within the <strong>${esc(department)}</strong> department` : ''} since <strong>${hireDate}</strong>.</p>
      <p>${esc(name)} has demonstrated professionalism and commitment during their employment with the company, which now spans ${years} year(s).</p>
      <p>This certificate is issued at the employee's request for official purposes and does not reflect any financial commitment by the company.</p>`
      : type === 'salary'
        ? `
      <p>To Whom It May Concern,</p>
      <p>This is to certify that <strong>${esc(name)}</strong>, employed by <strong>${company}</strong> as <strong>${esc(position)}</strong> since <strong>${hireDate}</strong>, currently receives a monthly base salary of <strong>${salary}</strong>.</p>
      <p>Additional allowances, incentives and deductions, where applicable, are reflected in the employee's monthly payslip.</p>
      <p>This certificate is issued at the employee's request to confirm their income and does not constitute a guarantee of future earnings.</p>`
        : `
      <p>To Whom It May Concern,</p>
      <p>This is to confirm the leave record of <strong>${esc(name)}</strong>, employed by <strong>${company}</strong> as <strong>${esc(position)}</strong> since <strong>${hireDate}</strong>.</p>
      <p>All approved leave taken by the employee is recorded and managed through the company's HR system in accordance with the applicable leave policy.</p>
      <p>This confirmation is issued at the employee's request for official purposes.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${type === 'employment' ? 'Employment' : type === 'salary' ? 'Salary' : 'Leave'} Certificate — ${esc(name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a2333; margin: 0; background: #eef0f4; }
  .sheet { max-width: 210mm; min-height: 280mm; margin: 16px auto; background: #fff; padding: 42px 46px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4756d7; padding-bottom: 18px; }
  .brand { display: flex; gap: 12px; align-items: center; }
  .brand-name { font-size: 22px; font-weight: 700; letter-spacing: 0.2px; }
  .brand-tagline { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.4px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; color: #4756d7; margin: 0 0 4px; }
  .doc-title .doc-no { font-size: 11px; color: #6b7280; font-family: 'Consolas', monospace; }
  .content { margin-top: 34px; line-height: 1.75; font-size: 13.5px; }
  .content p { margin: 0 0 14px; }
  .details { margin: 24px 0; }
  .details .row { display: flex; border-bottom: 1px solid #e5e7eb; padding: 9px 2px; font-size: 13px; }
  .details .row .k { width: 190px; color: #6b7280; }
  .details .row .v { font-weight: 600; }
  .signature { margin-top: 64px; }
  .signature .line { width: 240px; border-top: 1.5px solid #1a2333; margin-bottom: 8px; }
  .signature .role { font-size: 12.5px; color: #6b7280; }
  .actions { position: sticky; bottom: 12px; display: flex; gap: 10px; justify-content: center; padding: 10px; }
  .actions button { padding: 9px 22px; border: 1px solid #4756d7; background: #4756d7; color: #fff; border-radius: 8px; font-size: 13.5px; cursor: pointer; }
  .actions button.secondary { background: #fff; color: #4756d7; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; }
    .actions { display: none; }
    @page { size: A4; margin: 12mm; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        ${logo ? `<img src="${esc(logo)}" alt="${company}" style="height:44px;max-width:120px;object-fit:contain;" />` : `<div style="width:44px;height:44px;border-radius:10px;background:#4756d7;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;">${esc(company.slice(0, 2).toUpperCase())}</div>`}
        <div>
          <div class="brand-name">${company}</div>
          <div class="brand-tagline">${companyTagline || 'Management System'}</div>
        </div>
      </div>
      <div class="doc-title">
        <h1>${type === 'employment' ? 'Employment Certificate' : type === 'salary' ? 'Salary Certificate' : 'Leave Record Confirmation'}</h1>
        <div class="doc-no">Ref: ${esc(`${company.slice(0, 4).toUpperCase()}-${type.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`)}</div>
      </div>
    </div>

    <div class="content">
      <p>Date: <strong>${todayStr}</strong></p>
      ${body}
    </div>

    <div class="details">
      <div class="row"><div class="k">Employee Name</div><div class="v">${esc(name)}</div></div>
      <div class="row"><div class="k">Position</div><div class="v">${esc(position)}</div></div>
      <div class="row"><div class="k">Department</div><div class="v">${esc(department)}</div></div>
      <div class="row"><div class="k">Hire Date</div><div class="v">${hireDate}</div></div>
      <div class="row"><div class="k">Direct Manager</div><div class="v">${esc(manager)}</div></div>
      <div class="row"><div class="k">Work Shift</div><div class="v">${esc(shift)}</div></div>
      ${type === 'salary' ? `<div class="row"><div class="k">Monthly Base Salary</div><div class="v">${salary}</div></div>` : ''}
    </div>

    <div class="signature">
      <div class="line"></div>
      <div class="role">Human Resources — ${company}</div>
    </div>
  </div>
  <div class="actions">
    <button onclick="window.print()">Print / Save PDF</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>
</body>
</html>`;
}