import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appDir } from './paths';

/** De scripts uit de package.json van één app, als naam → commandotekst. */
export function packageScripts(id: string): Record<string, string> {
  const pad = join(appDir(id), 'package.json');
  if (!existsSync(pad)) return {};
  try {
    const json = JSON.parse(readFileSync(pad, 'utf8'));
    return json.scripts ?? {};
  } catch {
    return {};
  }
}
