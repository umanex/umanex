/**
 * De twee veiligheidsregels, puur: tekst in, reden of null uit.
 *
 * Ze staan in .mjs en niet in guards.ts zodat `scripts/guards-selftest.mjs` ze
 * rechtstreeks kan draaien — zonder testrunner, zonder extra dependency, en zonder
 * PM2 te moeten stoppen om de andere kant van de guard te zien. Zelfde patroon als
 * @umanex/tokens/roles, dat de Tailwind-preset uit een .mjs voedt.
 *
 * De I/O — welke app, welke package.json — zit in guards.ts. Hier staat alleen de regel.
 */

/**
 * De letterlijke tekst van wat een knop zou draaien.
 * `pnpm dev` lost op naar het dev-script van die app: de guards toetsen wat er écht
 * gebeurt, niet het label. Zonder die stap leest regel 1 "pnpm dev" en ziet hij de
 * `rm -rf .next` in cashflow's dev-script niet.
 *
 * @param {Record<string, string>} scripts  de scripts uit de package.json van die app
 * @param {string} startCommand             het startCommand uit appsConfig
 * @param {string} naam                     'start' of een scriptnaam
 * @returns {string}
 */
export function commandoTekst(scripts, startCommand, naam) {
  if (naam === 'start') {
    const scriptNaam = startCommand.match(/^pnpm\s+(?:run\s+)?([\w:-]+)$/)?.[1];
    return (scriptNaam ? scripts[scriptNaam] : undefined) ?? startCommand;
  }
  return scripts[naam] ?? naam;
}

/**
 * Waarom deze tekst niet mag draaien, of null als hij mag.
 *
 * Beide regels leiden af uit de tekst plus de gemeten PM2-staat; ze noemen geen app
 * bij naam. Cashflow is vandaag het enige geval, maar de dag dat een tweede app onder
 * PM2 komt is de guard er al.
 *
 * @param {string} tekst
 * @param {{ pm2Naam: string | null, branch: string }} ctx
 * @returns {string | null}
 */
export function blokkade(tekst, ctx) {
  // 1. Het script wist het build-artefact waaruit een draaiende server serveert.
  //    cashflow's dev is `rm -rf .next && next dev --port 3000`; die eerste helft
  //    haalt de vloer weg onder de PM2-productiebuild op diezelfde poort.
  if (ctx.pm2Naam && /rm\s+-rf\s+\S*\.next\b/.test(tekst)) {
    return `PM2 (${ctx.pm2Naam}) serveert uit deze map — dit script wist .next en breekt die server.`;
  }

  // 2. Een productiebuild op een feature branch zet ongemergde code klaar voor de
  //    draaiende server. Bouwen mag op main, na de merge.
  if (ctx.pm2Naam && /\bnext build\b/.test(tekst) && ctx.branch !== 'main') {
    return `PM2 (${ctx.pm2Naam}) draait hier — een build op '${ctx.branch}' zet ongemergde code klaar. Bouw op main na de merge.`;
  }

  return null;
}
