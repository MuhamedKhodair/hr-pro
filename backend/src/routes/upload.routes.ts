import { Router, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { AuthRequest } from '../types';
import { authenticate, authorize } from '../middleware/auth';
import { leaveAttachmentUpload, employeeDocumentUpload, brandLogoUpload, employeeExcelUpload, UPLOADS_PATH, verifyUploadContent, verifyExcelBuffer } from '../lib/upload';
import ExcelJS from 'exceljs';
import { bulkImport, importEmployeeSchema } from '../services/employee.service';

const router = Router();

function runUpload(
  middleware: typeof leaveAttachmentUpload,
  req: AuthRequest,
  res: Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    middleware(req, res, (err: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// --- Leave attachments ---
router.post('/leave', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await runUpload(leaveAttachmentUpload, req, res);
    if (!req.file) throw new AppError(400, 'No file provided');
    verifyUploadContent(req.file);
    res.status(201).json({
      success: true,
      data: {
        url: `/api/uploads/files/leave-attachments/${req.file.filename}`,
        fileName: req.file.originalname,
        sizeBytes: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Employee documents ---
router.post(
  '/employee-document/:employeeId',
  authenticate,
  authorize('Admin', 'HR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const employeeId = String(req.params.employeeId);
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) throw new AppError(404, 'Employee not found');

      await runUpload(employeeDocumentUpload, req, res);
      if (!req.file) throw new AppError(400, 'No file provided');
      verifyUploadContent(req.file);

      const label = (req.body.label as string) || req.file.originalname;
      const doc = await prisma.employeeDocument.create({
        data: {
          employeeId,
          label,
          fileName: req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
        },
      });
      res.status(201).json({
        success: true,
        data: { ...doc, url: `/api/uploads/files/employee-documents/${doc.fileName}` },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/employee-documents/:employeeId',
  authenticate,
  authorize('Admin', 'HR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const employeeId = String(req.params.employeeId);
      const docs = await prisma.employeeDocument.findMany({
        where: { employeeId },
        orderBy: { uploadedAt: 'desc' },
      });
      res.json({
        success: true,
        data: docs.map((d) => ({
          ...d,
          url: `/api/uploads/files/employee-documents/${d.fileName}`,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/employee-document/:id',
  authenticate,
  authorize('Admin', 'HR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const doc = await prisma.employeeDocument.findUnique({ where: { id } });
      if (!doc) throw new AppError(404, 'Document not found');
      await prisma.employeeDocument.delete({ where: { id } });
      const filePath = path.join(UPLOADS_PATH, 'employee-documents', doc.fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

// --- Employee Excel import (xlsx/xls) ---
router.post(
  '/employees/import',
  authenticate,
  authorize('Admin', 'HR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await runUpload(employeeExcelUpload, req, res);
      if (!req.file) throw new AppError(400, 'No file provided');
      if (!req.file.buffer) throw new AppError(400, 'Could not read file contents');
      verifyExcelBuffer(req.file.buffer);

      const workbook = new ExcelJS.Workbook();
      const raw = req.file.buffer;
      const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
      await workbook.xlsx.load(arrayBuffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new AppError(400, 'The file contains no worksheets');

      const headerMap: Record<string, string> = {
        name: 'name', 'employee name': 'name', 'full name': 'name',
        email: 'email',
        phone: 'phone', 'phone number': 'phone', 'mobile': 'phone',
        department: 'department',
        position: 'position', 'job title': 'position', 'title': 'position',
        'hire date': 'hireDate', 'hiredate': 'hireDate', 'start date': 'hireDate', 'join date': 'hireDate',
        salary: 'salary', 'base salary': 'salary', 'monthly salary': 'salary',
        'manager email': 'managerEmail', manager: 'managerEmail',
      };

      const headerRow = sheet.getRow(1);
      const columns: { key: string; index: number }[] = [];
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const raw = String(cell.value ?? '').trim().toLowerCase();
        const key = headerMap[raw];
        if (key) columns.push({ key, index: colNumber });
      });
      if (columns.length === 0) throw new AppError(400, 'No recognized header row. Expected: name, email, department, position, hire date, salary, phone, manager email');

      const rows: Array<Record<string, unknown>> = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const entry: Record<string, unknown> = {};
        let hasValue = false;
        for (const col of columns) {
          const value = row.getCell(col.index).value;
          if (value !== null && value !== undefined && value !== '') {
            hasValue = true;
            if (value instanceof Date) entry[col.key] = value.toISOString().split('T')[0];
            else entry[col.key] = String(value).trim();
          }
        }
        if (hasValue) rows.push(entry);
      });

      if (rows.length === 0) throw new AppError(400, 'No data rows found below the header row');
      const parsed = rows.map((row) => importEmployeeSchema.parse(row));
      const result = await bulkImport(parsed);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// --- Brand logo (public, used in sidebar / login / reports) ---
router.post('/logo', authenticate, authorize('Admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await runUpload(brandLogoUpload, req, res);
    if (!req.file) throw new AppError(400, 'No file provided');
    verifyUploadContent(req.file);
    const url = `/uploads/brand/${req.file.filename}`;
    const settings = await prisma.setting.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', logoPath: url },
      update: { logoPath: url },
    });
    res.status(201).json({ success: true, data: { ...settings, logoPath: url } });
  } catch (err) {
    next(err);
  }
});

// --- Authenticated file serving (prevents directory traversal + requires login) ---
router.get('/files/:folder/:filename', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const folder = path.basename(String(req.params.folder));
    const filename = path.basename(String(req.params.filename));
    const allowed = ['leave-attachments', 'employee-documents'];
    if (!allowed.includes(folder)) throw new AppError(400, 'Invalid folder');
    const filePath = path.join(UPLOADS_PATH, folder, filename);
    if (!fs.existsSync(filePath)) throw new AppError(404, 'File not found');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

export default router;
