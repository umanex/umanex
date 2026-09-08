import { repoStatus } from './git';
import { blokkade } from './guards';
import { listeningPorts, pm2Pids } from './processes';
import { appById } from './appsConfig';

export type Beoordeling = {
  poortBezet: boolean;
  geblokkeerd: string | null;
};

/**
 * De guard draait server-side opnieuw bij élke actie. De kaart toont hem al als
 * uitgeschakelde knop, maar dat is presentatie — een POST die de UI omzeilt hoort
 * op dezelfde regel te stuiten.
 */
export function beoordeel(id: string, actie: string): Beoordeling {
  const app = appById(id);
  const poorten = listeningPorts();
  const pm2 = pm2Pids();
  const luisterPid = app?.port != null ? (poorten.get(app.port) ?? null) : null;
  const pm2Naam = luisterPid !== null ? (pm2.get(luisterPid) ?? null) : null;
  return {
    poortBezet: luisterPid !== null,
    geblokkeerd: blokkade(id, actie, { pm2Naam, branch: repoStatus().branch }),
  };
}
