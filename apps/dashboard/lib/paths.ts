import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Twee wortels, bewust uit elkaar gehouden.
 *
 * `eigenRoot()` is de tree waarin dit dashboard zélf draait — daar hoort zijn
 * runtime-state (pid- en logbestanden). `beheerdeRoot()` is de tree wiens apps hij
 * start, stopt en meet; die kan een ándere zijn.
 *
 * Waarom dat onderscheid er is: het dashboard leefde eerst alleen in de tree waarin
 * hij draaide. Zodra daar een andere branch werd uitgecheckt bestond `apps/dashboard`
 * niet meer, en serveerde het achtergebleven proces 500 op elk verzoek — met een
 * ENOENT in een log dat niemand leest (gemeten 2026-09-07). Met `REPO_ROOT` draait
 * hij uit een eigen worktree en beheert hij de tree waarin jij werkt, ongeacht welke
 * branch daar staat.
 */

function omhoogNaarWorkspace(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** De tree waarin dit dashboard zelf staat. Nooit door REPO_ROOT beïnvloed. */
export function eigenRoot(): string {
  const root = omhoogNaarWorkspace(process.cwd());
  if (!root) throw new Error(`pnpm-workspace.yaml niet gevonden vanaf ${process.cwd()}`);
  return root;
}

/**
 * De tree wiens apps beheerd worden. `REPO_ROOT` wint; zonder die variabele is het
 * de eigen tree, wat het gewone geval blijft.
 *
 * Een gezette maar onbruikbare REPO_ROOT is een harde fout, geen stille terugval:
 * stil terugvallen op de eigen tree zou betekenen dat het dashboard een ándere tree
 * beheert dan de bedoeling, en dat is precies het soort verschil dat je pas merkt
 * wanneer je een app start die de verkeerde code serveert.
 */
export function beheerdeRoot(): string {
  const opgegeven = process.env.REPO_ROOT;
  if (!opgegeven) return eigenRoot();
  const pad = resolve(opgegeven);
  if (!existsSync(join(pad, 'pnpm-workspace.yaml'))) {
    throw new Error(`REPO_ROOT=${opgegeven} bevat geen pnpm-workspace.yaml — geen monorepo-root`);
  }
  return pad;
}

/** Beheert het dashboard een ándere tree dan die waarin hij draait? */
export function beheertVreemdeTree(): boolean {
  return beheerdeRoot() !== eigenRoot();
}

export function appDir(id: string): string {
  return join(beheerdeRoot(), 'apps', id);
}

/** Runtime-state hoort bij de tree waarin het dashboard draait, niet bij de beheerde. */
export function runtimeDir(): string {
  const dir = join(eigenRoot(), 'apps/dashboard/.runtime');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export const pidPath = (id: string) => join(runtimeDir(), `${id}.pid`);
export const logPath = (id: string) => join(runtimeDir(), `${id}.log`);
export const exitPath = (id: string) => join(runtimeDir(), `${id}.exit`);
