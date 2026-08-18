import { execSync } from 'node:child_process';
import path from 'node:path';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const PRISMA_DIR = path.join(BACKEND_ROOT, 'prisma');

export function dbUrl(dbFile: string) {
  return `file:${path.join(PRISMA_DIR, dbFile).replace(/\\/g, '/')}`;
}

export interface TestEnv {
  base: string;
  prisma: PrismaClient;
  request: (
    method: string,
    path: string,
    opts?: { token?: string; body?: unknown },
  ) => Promise<{ status: number; json: any; text: string; headers: Headers }>;
  close: () => Promise<void>;
}

export async function startTestEnv(dbFile: string): Promise<TestEnv> {
  process.env.NODE_ENV = 'test';
  const url = dbUrl(dbFile);
  process.env.DATABASE_URL = url;

  try {
    execSync('node node_modules/prisma/build/index.js db push --force-reset --skip-generate', {
      cwd: BACKEND_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (err: any) {
    throw new Error(`db push failed: ${err.stdout?.toString() ?? ''} ${err.stderr?.toString() ?? ''}`, { cause: err });
  }

  const { app } = await import('../app');
  const prisma = new PrismaClient();
  const server: Server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    prisma,
    request: async (method, path, opts = {}) => {
      const headers: Record<string, string> = {};
      if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(base + path, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return { status: res.status, json, text, headers: res.headers };
    },
    close: async () => {
      server.close();
      await prisma.$disconnect();
    },
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function loginAs(env: TestEnv, email: string, password: string) {
  const res = await env.request('POST', '/api/auth/login', { body: { email, password } });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.json)}`);
  }
  return res.json.data as { user: any; accessToken: string; refreshToken: string };
}
