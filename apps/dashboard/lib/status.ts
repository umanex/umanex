import { packageScripts } from './appScripts';
import { APPS } from './appsConfig';
import { gewijzigdeBestanden, repoStatus } from './git';
import { blokkade } from './guards';
import { eigenPid, laatsteExit, listeningPorts, pm2Pids } from './processes';
import type { AppState, AppStatus, Owner, StatusPayload } from './types';

/**
 * Eén meting voor alle apps samen. lsof, pm2 en git worden elk één keer aangeroepen
 * en over de kaarten verdeeld — niet zeven keer per poll.
 */
export function buildStatus(): StatusPayload {
  const poorten = listeningPorts();
  const pm2 = pm2Pids();
  const repo = repoStatus();

  const apps: AppStatus[] = APPS.map((app) => {
    const luisterPid = app.port !== null ? (poorten.get(app.port) ?? null) : null;
    const onzePid = eigenPid(app.id);
    const pm2Naam = luisterPid !== null ? (pm2.get(luisterPid) ?? null) : null;

    // Volgorde is inhoudelijk: wie de socket vasthoudt is de eigenaar. PM2 wint van
    // een pidbestand van ons, want dat bestand kan verouderd zijn terwijl de socket
    // dat nooit is.
    let owner: Owner = null;
    if (pm2Naam) owner = 'pm2';
    else if (luisterPid !== null && onzePid !== null) owner = 'dashboard';
    else if (luisterPid !== null) owner = 'extern';
    else if (onzePid !== null) owner = 'dashboard';

    const exit = laatsteExit(app.id);
    let state: AppState;
    if (luisterPid !== null) state = owner === 'dashboard' ? 'draait' : 'extern';
    else if (onzePid !== null) state = 'startend';
    else if (exit !== null) state = 'mislukt';
    else state = 'gestopt';

    const ctx = { pm2Naam, branch: repo.branch };
    const beschikbaar = packageScripts(app.id);

    return {
      id: app.id,
      label: app.label,
      mode: app.mode,
      port: app.port,
      localUrl: app.localUrl,
      links: app.links,
      state,
      owner,
      ownerLabel: pm2Naam,
      pid: onzePid,
      scripts: app.scripts
        .filter((naam) => naam in beschikbaar)
        .map((naam) => ({ naam, geblokkeerd: blokkade(app.id, naam, ctx) })),
      startGeblokkeerd: blokkade(app.id, 'start', ctx),
      git: { gewijzigd: gewijzigdeBestanden(app.id) },
      laatsteExit: exit,
      logPad: app.mode === 'inline' ? `apps/dashboard/.runtime/${app.id}.log` : null,
    };
  });

  return { repo, apps, gemetenOp: new Date().toISOString() };
}
