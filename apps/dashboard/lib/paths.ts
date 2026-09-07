import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Loopt omhoog tot pnpm-workspace.yaml. Niet `cwd + '/../..'`: die aanname klopt
 * alleen zolang Next vanuit apps/dashboard start, en breekt stil zodra iets de app
 * vanuit de root aanroept.
 */
export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`pnpm-workspace.yaml niet gevonden vanaf ${process.cwd()}`);
}

export function appDir(id: string): string {
  return join(repoRoot(), 'apps', id);
}

export function runtimeDir(): string {
  const dir = join(repoRoot(), 'apps/dashboard/.runtime');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export const pidPath = (id: string) => join(runtimeDir(), `${id}.pid`);
export const logPath = (id: string) => join(runtimeDir(), `${id}.log`);
export const exitPath = (id: string) => join(runtimeDir(), `${id}.exit`);
