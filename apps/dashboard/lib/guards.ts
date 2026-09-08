import { packageScripts } from './appScripts';
import { appById } from './appsConfig';
import { blokkade as regel, commandoTekst as tekstVan } from './guardRules.mjs';

export type GuardContext = {
  /** Naam van het PM2-proces dat de poort van deze app bezet, of `null`. */
  pm2Naam: string | null;
  branch: string;
};

/** De I/O-kant: welke app, welke package.json. De regel zelf staat in guardRules.mjs. */
export function commandoTekst(id: string, naam: string): string {
  return tekstVan(packageScripts(id), appById(id)?.startCommand ?? '', naam);
}

/** Waarom een knop niet mag draaien, of `null` als hij mag. */
export function blokkade(id: string, naam: string, ctx: GuardContext): string | null {
  return regel(commandoTekst(id, naam), ctx);
}
