import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRISMA_DIR = path.join(ROOT, 'prisma');
const BACKUP_DIR = path.join(ROOT, 'backups');
const KEEP = 20;

function dbSource() {
  const raw = process.env.DATABASE_URL;
  if (raw?.startsWith('file:')) {
    const rel = raw.slice(5).replace(/\\/g, '/');
    return rel.startsWith('/') ? rel.slice(1) : rel;
  }
  return 'dev.db';
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const dbFile = path.join(PRISMA_DIR, dbSource());
if (!fs.existsSync(dbFile)) {
  console.error(`Database not found at ${dbFile}`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const base = path.basename(dbFile, path.extname(dbFile));
const stamp = timestamp();

const sources = [dbFile];
for (const suffix of ['-wal', '-shm', '-journal']) {
  if (fs.existsSync(`${dbFile}${suffix}`)) sources.push(`${dbFile}${suffix}`);
}

for (const src of sources) {
  const ext = src === dbFile ? '.db' : src.slice(src.indexOf('.db'));
  fs.copyFileSync(src, path.join(BACKUP_DIR, `${base}-${stamp}${ext}`));
}

const backups = fs
  .readdirSync(BACKUP_DIR)
  .filter((f) => f.startsWith(`${base}-`) && f.endsWith('.db'))
  .sort();
while (backups.length > KEEP) {
  const oldest = backups.shift();
  const stem = oldest.replace(/\.db$/, '');
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    if (f === oldest || f.startsWith(`${stem}.`)) fs.unlinkSync(path.join(BACKUP_DIR, f));
  }
}

const size = fs.statSync(sources[0]).size;
console.log(`Backed up ${base}.db (${(size / 1024).toFixed(1)} KB) to ${BACKUP_DIR}`);
console.log(`Keeping the ${KEEP} most recent ${base}-*.db backups`);