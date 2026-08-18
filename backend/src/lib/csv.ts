const FORMULA_PREFIX = /^[=+\-@]/;

export function neutralizeFormulaCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (FORMULA_PREFIX.test(str)) {
    return `'${str}`;
  }
  return str;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = neutralizeFormulaCell(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n'); // BOM for Excel UTF-8
}

export function csvResponse(res: import('express').Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}
