import { execFileSync, spawn } from 'node:child_process';
import { openSync, rmSync, writeFileSync } from 'node:fs';
import { appById } from './appsConfig';
import { appDir, exitPath, logPath, pidPath } from './paths';
import { eigenPid } from './processes';

export type LaunchResult = {
  ok: boolean;
  bericht: string;
};

const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** AppleScript-string: backslash en dubbele quote moeten er dubbel in. */
const osaQuote = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Opent een nieuwe Terminal-tab met de juiste cwd en het commando.
 *
 * Dit is het pad voor alles wat je wílt zien of bedienen: Expo's dev-client leest
 * `i`/`r`/`a` van een TTY, en een build of type-check kijk je af terwijl hij loopt.
 * Het dashboard heeft geen logpaneel, dus alles met leesbare output gaat hierlangs.
 */
export function openTerminal(dir: string, commando: string): LaunchResult {
  const shell = `cd ${shQuote(dir)} && ${commando}`;
  const script = `tell application "Terminal"\n  activate\n  do script "${osaQuote(shell)}"\nend tell`;
  try {
    execFileSync('osascript', ['-e', script], { timeout: 10000, stdio: ['ignore', 'ignore', 'pipe'] });
    return { ok: true, bericht: `Terminal-tab geopend: ${commando}` };
  } catch (e) {
    // macOS weigert Apple events als Terminal-automation niet is toegestaan
    // (Systeeminstellingen → Privacy → Automatisering). Dat is een zichtbare fout,
    // geen stille no-op.
    const stderr = (e as { stderr?: Buffer }).stderr?.toString().trim();
    return {
      ok: false,
      bericht: stderr?.includes('-1743') || stderr?.includes('Not authorized')
        ? 'macOS weigert Terminal-automatisering. Sta het toe bij Systeeminstellingen → Privacy en beveiliging → Automatisering.'
        : `osascript faalde: ${stderr || 'onbekende fout'}`,
    };
  }
}

/**
 * Detached child process met output naar .runtime/<id>.log.
 *
 * `detached: true` geeft het een eigen procesgroep. Twee gevolgen die allebei nodig
 * zijn: het overleeft een herstart van deze dev-server, en `kill(-pid)` haalt straks
 * ook de kinderen om (pnpm start next, next start zijn workers).
 */
function spawnInline(id: string, dir: string, commando: string): LaunchResult {
  rmSync(exitPath(id), { force: true });
  const out = openSync(logPath(id), 'a');
  // `trap … EXIT` en niet `<commando>; echo $?`: die tweede vorm mist elke exit-code
  // van een commando dat de shell zélf beëindigt (`exit 1`, een `exec`, een signaal) —
  // dan draait de echo nooit en blijft de kaart op 'gestopt' staan alsof er niets
  // misging. Gemeten met `exit 42`: geen .exit-bestand, geen foutstaat.
  const wegschrijven = `trap "echo \\$? > ${shQuote(exitPath(id))}" EXIT`;
  const kind = spawn('/bin/zsh', ['-lc', `${wegschrijven}\n${commando}`], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', out, out],
  });
  if (!kind.pid) return { ok: false, bericht: 'spawn gaf geen pid terug' };
  kind.unref();
  writeFileSync(pidPath(id), String(kind.pid));
  return { ok: true, bericht: `gestart (pid ${kind.pid}) — log: apps/dashboard/.runtime/${id}.log` };
}

export function startApp(id: string, poortBezet: boolean): LaunchResult {
  const app = appById(id);
  if (!app) return { ok: false, bericht: `onbekende app: ${id}` };

  // Dubbele klik mag geen tweede proces opleveren. De poort is de toets, niet de
  // pid: een app die buiten het dashboard gestart is heeft hier geen pidbestand.
  if (poortBezet) return { ok: false, bericht: `poort ${app.port} is al bezet — er draait al iets` };
  if (eigenPid(id)) return { ok: false, bericht: 'dit dashboard heeft hier al een proces draaien' };

  const dir = appDir(id);
  return app.mode === 'terminal'
    ? openTerminal(dir, app.startCommand)
    : spawnInline(id, dir, app.startCommand);
}

/** Stopt alleen wat dit dashboard zelf startte — de hele procesgroep, niet enkel de shell. */
export function stopApp(id: string): LaunchResult {
  const pid = eigenPid(id);
  if (!pid) {
    rmSync(pidPath(id), { force: true });
    return { ok: false, bericht: 'geen eigen proces om te stoppen' };
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Al weg tussen de poll en deze klik in. Het pidbestand opruimen is dan de
      // hele actie — de kaart valt vanzelf terug naar 'gestopt'.
    }
  }
  rmSync(pidPath(id), { force: true });
  return { ok: true, bericht: `gestopt (pid ${pid})` };
}

/** Elk package.json-script draait in een Terminal-tab, zodat je de output ziet. */
export function runScript(id: string, naam: string): LaunchResult {
  const app = appById(id);
  if (!app) return { ok: false, bericht: `onbekende app: ${id}` };
  if (!app.scripts.includes(naam)) return { ok: false, bericht: `script '${naam}' staat niet in de config van ${id}` };
  return openTerminal(appDir(id), `pnpm run ${naam}`);
}
