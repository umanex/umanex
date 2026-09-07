import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { exitPath, pidPath } from './paths';

function stil(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    // lsof geeft exit 1 als er niets luistert, pm2 faalt als het niet geïnstalleerd is.
    // Beide zijn een geldige "niets gevonden", geen fout.
    return '';
  }
}

/**
 * Poort → pid van alles wat lokaal luistert. Eén lsof-aanroep voor alle apps samen;
 * per poort pollen is acht keer zo duur en levert hetzelfde.
 */
export function listeningPorts(): Map<number, number> {
  const uit = new Map<number, number>();
  const raw = stil('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pn']);
  let pid = 0;
  for (const regel of raw.split('\n')) {
    if (regel.startsWith('p')) pid = Number(regel.slice(1));
    else if (regel.startsWith('n')) {
      // n-regels zien er uit als *:3000, 127.0.0.1:3010 of [::1]:6006
      const m = regel.match(/:(\d+)$/);
      if (m && pid) {
        const poort = Number(m[1]);
        if (!uit.has(poort)) uit.set(poort, pid);
      }
    }
  }
  return uit;
}

/** pid → PM2-procesnaam, voor alles wat PM2 online heeft. */
export function pm2Pids(): Map<number, string> {
  const uit = new Map<number, string>();
  const raw = stil('pm2', ['jlist']);
  if (!raw.trim().startsWith('[')) return uit;
  try {
    for (const p of JSON.parse(raw)) {
      if (p?.pm2_env?.status === 'online' && p?.pid) uit.set(Number(p.pid), String(p.name));
    }
  } catch {
    // Kapotte jlist-output is een leeg antwoord, geen crash van het dashboard.
  }
  return uit;
}

export function leeft(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** De pid die dit dashboard voor deze app noteerde, mits hij nog leeft. */
export function eigenPid(id: string): number | null {
  const pad = pidPath(id);
  if (!existsSync(pad)) return null;
  const pid = Number(readFileSync(pad, 'utf8').trim());
  if (!pid || !leeft(pid)) return null;
  return pid;
}

/** Exit-code van de laatst afgelopen inline start; `null` zolang hij draaide of slaagde. */
export function laatsteExit(id: string): number | null {
  const pad = exitPath(id);
  if (!existsSync(pad)) return null;
  const code = Number(readFileSync(pad, 'utf8').trim());
  return Number.isFinite(code) && code !== 0 ? code : null;
}
