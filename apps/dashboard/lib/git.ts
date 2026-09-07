import { execFileSync } from 'node:child_process';
import { repoRoot } from './paths';
import type { RepoStatus } from './types';

function git(args: string[]): string {
  try {
    return execFileSync('git', ['-C', repoRoot(), ...args], {
      encoding: 'utf8',
      timeout: 4000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Branch en achterstand zijn repo-breed, niet per app: in een monorepo deelt elke app
 * dezelfde HEAD. Ze horen dus in de kopbalk, niet op de kaart — een "branch" per kaart
 * zou zeven keer hetzelfde beweren.
 *
 * Geen `git fetch` hier: die hoort niet in een poll die elke 2s draait. `origin/main` is
 * dus zo vers als de laatste fetch, en dat staat ook zo in de UI.
 */
export function repoStatus(): RepoStatus {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'onbekend';
  const telling = git(['rev-list', '--left-right', '--count', 'origin/main...HEAD']);
  const [achter, voor] = telling.split(/\s+/).map((n) => Number(n) || 0);
  return { branch, voor: voor ?? 0, achter: achter ?? 0 };
}

/**
 * Aantal gewijzigde bestanden binnen één app-map. `-uall` is niet optioneel:
 * zonder die vlag telt een nieuwe map als één regel in plaats van als zijn bestanden.
 */
export function gewijzigdeBestanden(id: string): number {
  const uit = git(['status', '--porcelain', '-uall', '--', `apps/${id}`]);
  return uit ? uit.split('\n').filter(Boolean).length : 0;
}
