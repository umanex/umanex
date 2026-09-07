# CLAUDE.md — apps/dashboard

Lokaal dev-dashboard voor de monorepo. Next.js (App Router), dev op poort 3010,
gebonden aan **127.0.0.1**. Toont per app in `apps/` de status en start of stopt hem.

**Deze app deployt nooit.** Zijn API-routes voeren shell-commando's uit op de machine
waarop hij draait; er hoort dus geen `vercel.json`, geen Vercel-project en geen
publieke bind bij. De loopback-bind staat in het `dev`-script, en
`lib/localOnly.ts` weigert elke request met een niet-loopback Host-header — twee
sluizen, want de eerste is één regel die iemand kan wegnemen.

## Wat waar staat

| Laag | Bestand | Verantwoordelijkheid |
|---|---|---|
| Configuratie | `lib/appsConfig.ts` | de app-lijst: modus, poort, startcommando, links, scriptmenu |
| Meting | `lib/processes.ts` | `lsof` (poort → pid), `pm2 jlist` (pid → naam), pid-leven |
| Veiligheid | `lib/guards.ts` | welk script niet mag draaien, en waarom |
| Uitvoering | `lib/launch.ts` | detached spawn, osascript-Terminal-tab, procesgroep stoppen |
| Samenstelling | `lib/status.ts` | één meting per poll, verdeeld over de kaarten |

**De app-lijst is statisch en niet afgeleid uit `apps/*`.** Modus, poort en
startcommando zijn oordelen: rowtrack heeft geen `dev`-script maar moet
`expo start --dev-client` draaien, en cashflow's `dev` claimt een poort die PM2 al
bezit. Een lijst die dat uit `package.json` afleidt, zou die twee stil verkeerd hebben.

## Wat het dashboard nooit doet

- **Een proces stoppen dat het niet zelf startte.** De stop-knop verschijnt alleen bij
  `owner === 'dashboard'` — een pid die dit dashboard in `.runtime/<app>.pid` schreef en
  die nog leeft. PM2 en een extern gestarte dev-server krijgen geen knop.
- **Een commando draaien dat uit de request komt.** De request noemt een app-id en een
  scriptnaam; wát er draait komt uit `appsConfig.ts` en de `package.json` van die app.
- **`.next` wissen onder een draaiende server.** `guards.ts` blokkeert elk script waarvan
  de tekst `rm -rf …​.next` bevat zolang PM2 die poort bezet — dat is cashflow's
  `dev`-script, dat de vloer weghaalt onder de PM2-productiebuild op :3000.
- **Bouwen op een feature branch onder PM2.** `next build` is geblokkeerd zolang PM2 die
  app serveert en HEAD niet op `main` staat: dat zou ongemergde code klaarzetten.

Beide guards leiden af uit de **tekst van het script** plus de gemeten PM2-staat. Ze
noemen geen app bij naam, zodat een tweede app onder PM2 er meteen door gedekt is.

## Design-systeem-bron

- **Preset:** `@umanex/config/tailwind/preset`
- **Componentbron:** `@umanex/ui`
- **Storybook:** `pnpm --filter @umanex/ui storybook` (:6006)

## Verify-pad

| Capability | Commando |
|---|---|
| **Verse build** | `pnpm --filter dashboard build` — veilig: deze app serveert nergens uit een langlopend proces |
| **Types** | `pnpm --filter dashboard type-check` |
| **Lint + tokenregels** | `pnpm --filter dashboard lint` (`@umanex/config/eslint/tokens` zit in `.eslintrc.js`) |
| **Tokenguard** | `pnpm --filter @umanex/tokens guard` |
| **Design-systeem-declaratie** | `pnpm ds:guard` (tegenproef: `pnpm ds:guard:selftest`) |
| **Render vastleggen** | `pnpm --filter dashboard dev` → `http://127.0.0.1:3010`; dark mode via de ThemeToggle rechtsboven |
| **State forceren** | De vier kaartstaten hangen aan gemeten feiten, dus je forceert ze door het feit te maken: `gestopt` = niets op de poort · `draait` = start vanuit het dashboard · `extern` = `pnpm --filter <app> dev` in een eigen terminal · `mislukt` = zet tijdelijk een onzinnig `startCommand` in `appsConfig.ts` |
| **Guard tegenproeven** | Beide kanten van `blokkade()`: mét PM2 online moet cashflow's `dev` en `build` een reden teruggeven; met `pm2 stop cashflow` moeten ze `null` geven. Draai `pm2 start cashflow` daarna weer aan |
| **Loopback-weigering** | `curl -s -o /dev/null -w '%{http_code}' -H 'Host: 10.0.0.5:3010' http://127.0.0.1:3010/api/status` → verwacht `403`; zonder de Host-header `200` |
| **Flow aandrijven** | geen — er is nog geen flow-harness (`scripts/flow-harness.mjs`) zoals bij portfolio en jobradar. Eén scherm, geen navigatie; bouw hem als er routes bijkomen |
| **Invariant draaien** | geen — deze app rekent niets uit, hij meet en spawnt |

**Let op bij verifiëren:** `pm2 stop cashflow` legt de draaiende productieserver op :3000
plat. Doe dat alleen bewust en zet hem daarna terug aan — of toets de guard op de
andere kant door de PM2-staat te lezen in plaats van te veranderen.
