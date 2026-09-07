// Gedeeld door de configlaag, de API-routes en de kaartcomponenten.

/**
 * Hoe een app opgestart wordt.
 * - `inline`   — detached child process vanuit de API-route; output naar .runtime/<id>.log
 * - `terminal` — een nieuwe Terminal-tab via osascript, omdat het proces toetsaanslagen
 *                verwacht (Expo's dev-client leest `i`, `r`, `a` van een TTY)
 */
export type LaunchMode = 'inline' | 'terminal';

export type AppLink = {
  label: string;
  href: string;
};

export type AppConfig = {
  /** Mapnaam onder apps/ — ook de sleutel in elke API-call. */
  id: string;
  label: string;
  mode: LaunchMode;
  /** Wat er draait bij "start". Nooit uit de request; altijd van hier. */
  startCommand: string;
  /** Poort waarop de status gemeten wordt. `null` = deze app luistert nergens. */
  port: number | null;
  /** Waarop de poort te bereiken is, als hij een browser-URL heeft. */
  localUrl: string | null;
  links: AppLink[];
  /** package.json-scripts die in het scriptmenu komen, in deze volgorde. */
  scripts: string[];
};

/**
 * Wie het proces op de poort bezit. Bepaalt of er een stop-knop mag staan:
 * alleen `dashboard` mag gestopt worden.
 */
export type Owner = 'dashboard' | 'pm2' | 'extern' | null;

export type AppState =
  | 'laden'      // eerste poll nog niet binnen
  | 'gestopt'
  | 'startend'   // pid leeft, poort nog niet
  | 'draait'
  | 'extern'     // luistert, maar niet door ons gestart
  | 'mislukt';   // laatste start eindigde met exit != 0

export type ScriptState = {
  naam: string;
  /** Reden waarom hij niet mag draaien; `null` = toegestaan. */
  geblokkeerd: string | null;
};

export type GitState = {
  gewijzigd: number;
};

export type AppStatus = {
  id: string;
  label: string;
  mode: LaunchMode;
  port: number | null;
  localUrl: string | null;
  links: AppLink[];
  state: AppState;
  owner: Owner;
  /** Naam van het PM2-proces dat de poort bezet, als owner 'pm2' is. */
  ownerLabel: string | null;
  pid: number | null;
  scripts: ScriptState[];
  /** Reden waarom de start-knop uit staat, of `null`. */
  startGeblokkeerd: string | null;
  git: GitState;
  /** Exit-code van de laatst afgelopen inline start, als die niet-nul was. */
  laatsteExit: number | null;
  logPad: string | null;
};

export type RepoStatus = {
  branch: string;
  /** Pad van de tree die beheerd wordt. */
  root: string;
  /** True als dat een andere tree is dan waarin het dashboard zelf draait. */
  vreemdeTree: boolean;
  voor: number;   // commits op HEAD die origin/main niet heeft
  achter: number; // commits op origin/main die HEAD niet heeft
};

export type StatusPayload = {
  repo: RepoStatus;
  apps: AppStatus[];
  gemetenOp: string;
};
