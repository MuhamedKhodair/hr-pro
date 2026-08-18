import ExcelJS from 'exceljs';

const FORMULA_PREFIX = /^[=+\-@]/;

function safeCell(value: unknown): unknown {
  if (typeof value === 'string' && FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}

export async function excelResponse(
  res: import('express').Response,
  filename: string,
  sheetName: string,
  headers: { header: string; key: string; width?: number }[],
  rows: Record<string, unknown>[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HR Pro';
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = headers.map((h) => ({ header: h.header, key: h.key, width: h.width ?? 18 }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4756D7' },
  };
  headerRow.alignment = { vertical: 'middle' };

  rows.forEach((row) => {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      sanitized[key] = safeCell(value);
    }
    sheet.addRow(sanitized);
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: 'middle' };
    if (rowNumber % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F3F8' } };
    }
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(rows.length + 1, 2), column: headers.length } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}