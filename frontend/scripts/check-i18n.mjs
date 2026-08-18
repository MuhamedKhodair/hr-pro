#!/usr/bin/env node
/**
 * i18n completeness checker.
 *
 * - Extracts keys from src/lib/translations/{ar,en}.ts
 * - Scans src/**\/*.{ts,tsx} for t('...') usages
 * - Reports: keys missing from either dictionary and keys used but undefined
 *
 * Run: npm run i18n:check
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');

const dicts = {};
for (const name of ['ar', 'en']) {
  const file = join(srcDir, 'lib', 'translations', `${name}.ts`);
  const content = readFileSync(file, 'utf8');
  dicts[name] = new Set();
  for (const m of content.matchAll(/^\s*(['"])(.+?)\1\s*:/gm)) {
    dicts[name].add(m[2]);
  }
}

const allFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
    } else if (['.ts', '.tsx'].includes(extname(p))) {
      allFiles.push(p);
    }
  }
}
walk(srcDir);

const used = new Set();
const keyPattern = /\bt\(\s*(['"])(.*?)\1\s*\)/g;
for (const file of allFiles) {
  const content = readFileSync(file, 'utf8');
  for (const m of content.matchAll(keyPattern)) {
    used.add(m[2]);
  }
}

const en = dicts.en;
const ar = dicts.ar;
const problems = [];

for (const key of en) {
  if (!ar.has(key)) problems.push(`[ar.ts] missing: '${key}'`);
}
for (const key of ar) {
  if (!en.has(key)) problems.push(`[en.ts] missing: '${key}'`);
}
for (const key of used) {
  if (!en.has(key) && !ar.has(key)) {
    problems.push(`used but not defined: '${key}'`);
  }
}

if (problems.length > 0) {
  console.error(`i18n check failed (${problems.length} issue(s)):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`i18n check passed: ${en.size} en keys, ${ar.size} ar keys, ${used.size} keys used.`);
