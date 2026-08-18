import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppError } from './errors';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subfolder: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(UPLOAD_ROOT, subfolder);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, name);
    },
  });
}

function extToMime(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  return map[ext];
}

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const mime = file.mimetype === 'application/octet-stream' ? extToMime(file.originalname) : file.mimetype;
  if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
    return cb(new Error('Only JPEG, PNG, WebP images and PDF files are allowed'));
  }
  cb(null, true);
}

function imageFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const mime = file.mimetype === 'application/octet-stream' ? extToMime(file.originalname) : file.mimetype;
  if (!mime || !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    return cb(new Error('Only JPEG, PNG and WebP images are allowed'));
  }
  cb(null, true);
}

export const leaveAttachmentUpload = multer({
  storage: makeStorage('leave-attachments'),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('file');

export const employeeDocumentUpload = multer({
  storage: makeStorage('employee-documents'),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('file');

export const brandLogoUpload = multer({
  storage: makeStorage('brand'),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('file');

const EXCEL_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

function excelFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXCEL_MIME_TYPES.has(file.mimetype) && !['.xlsx', '.xls'].includes(ext)) {
    return cb(new Error('Only .xlsx or .xls files are allowed'));
  }
  cb(null, true);
}

export const employeeExcelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: excelFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('file');

export const UPLOADS_PATH = UPLOAD_ROOT;

// --- Magic-byte sniffing (verifies content matches declared type) ---

export function sniffMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

function expectedMime(file: Express.Multer.File): string | undefined {
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype;
  return extToMime(file.originalname);
}

/** Verifies a disk-stored upload's content; deletes the file on mismatch. */
export function verifyUploadContent(file: Express.Multer.File): void {
  const expected = expectedMime(file);
  if (!expected) {
    fs.unlink(file.path, () => {});
    throw new AppError(400, 'File type not allowed');
  }
  const bytes = fs.readFileSync(file.path);
  const sniffed = sniffMime(bytes);
  if (!sniffed || sniffed !== expected) {
    fs.unlink(file.path, () => {});
    throw new AppError(400, 'File content does not match its declared type');
  }
}

/** Verifies an in-memory Excel upload is a real workbook (zip or OLE2 container). */
export function verifyExcelBuffer(buffer: Buffer): void {
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle2 = buffer.length >= 8 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  if (!isZip && !isOle2) {
    throw new AppError(400, 'File does not appear to be an Excel workbook');
  }
}
