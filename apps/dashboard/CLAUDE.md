# CLAUDE.md — apps/dashboard

Lokaal dev-dashboard voor de monorepo. Next.js (App Router), draait permanent onder
**PM2** als production build op poort 3010, gebonden aan **127.0.0.1**. Toont per app
in `apps/` de status en start of stopt hem.

**Deze app deployt nooit.** Zijn API-routes voeren shell-commando's uit op de machine
waarop hij draait; er hoort dus geen `vercel.json`, geen Vercel-project en geen
publieke bind bij. De loopback-bind staat in het `dev`-script én in de PM2-args
(`--hostname 127.0.0.1`), en `lib/localOnly.ts` weigert elke request met een
niet-loopback Host-header — twee sluizen, want de eerste is één regel die iemand kan
wegnemen. Gemeten 2026-09-09 op de PM2-app: `lsof` toont `127.0.0.1:3010`, een `curl`
op het LAN-adres komt niet binnen, en met een vreemde `Host`-header is het 403.

## Draait onder PM2 — dus build + restart, geen `dev`

Het dashboard hoort er te zijn zonder dat je hem start, dus draait hij als PM2-app
`dashboard` (`autorestart: true`, `next start --hostname 127.0.0.1 --port 3010`) uit de
hoofdtree. De browser ziet dan de gebouwde `.next`, niet je live source — een
bronwijziging is pas zichtbaar na:

```bash
pnpm --filter dashboard pm2:rebuild     # next build && pm2 restart dashboard
```

Alleen op `main`. Op een feature branch zet dat ongemergde code klaar op :3010 —
dezelfde regel als bij cashflow.

**Opzet op een nieuwe machine** (één keer, en dit ís de autostart):

```bash
pnpm --filter dashboard build
pnpm --filter dashboard pm2:start
pm2 save
```

`pm2 save` schrijft `~/.pm2/dump.pm2`; de LaunchAgent `~/Library/LaunchAgents/pm2.jeroen.plist`
draait bij het inloggen `pm2 resurrect` over precies dat bestand. Gemeten in
`~/.pm2/pm2.log`: op 2026-08-30 kwam de daemon 3½ minuut na boot op (20:38:43, boot
20:35:15) met cashflow meteen online. Zonder die `pm2 save` staat de app niet in de
dump en komt hij na een reboot niet terug.

**`next dev` sloopt de draaiende server.** Dev-mode schrijft zijn eigen build in
dezelfde `.next`, waarna `next start` faalt op *Could not find a production build*
(gemeten 2026-09-09: PM2 op `errored`, `BUILD_ID` weg). Wil je het dashboard zélf
ontwikkelen: `pm2 stop dashboard` — 3010 is dan vrij, gemeten — daarna
`pnpm --filter dashboard dev`, en na afloop `pnpm --filter dashboard pm2:rebuild`. Een
kale `pm2 start dashboard` komt dan níet meer omhoog.

**`pm2 status` is geen bewijs dat hij draait**, hier net zomin als bij cashflow. Toets
met `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/` → 200.

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
| **Verse build** | `pnpm --filter dashboard pm2:rebuild` — bouwt én herstart de PM2-app op :3010, en alleen op `main`. Draait de server nog op oudere bron? `cd apps/dashboard && find app components lib -newer .next/BUILD_ID` — leeg = actueel (tweezijdig gemeten 2026-09-09: na een `touch` op `lib/status.ts` noemt hij dat bestand, na de rebuild is hij weer leeg). Een kale `build` is veilig maar verandert niets aan wat PM2 serveert tot je herstart |
| **Types** | `pnpm --filter dashboard type-check` |
| **Lint + tokenregels** | `pnpm --filter dashboard lint` (`@umanex/config/eslint/tokens` zit in `.eslintrc.js`) |
| **Tokenguard** | `pnpm --filter @umanex/tokens guard` |
| **Design-systeem-declaratie** | `pnpm ds:guard` (tegenproef: `pnpm ds:guard:selftest`) |
| **Render vastleggen** | De app draait al: `http://127.0.0.1:3010` (PM2, gebouwde `.next`). Je eigen wijziging zie je pas na `pm2:rebuild`, of via `pm2 stop dashboard` + `pnpm --filter dashboard dev` — zie de PM2-sectie hierboven. Dark mode via de ThemeToggle rechtsboven |
| **State forceren** | De vier kaartstaten hangen aan gemeten feiten, dus je forceert ze door het feit te maken: `gestopt` = niets op de poort · `draait` = start vanuit het dashboard · `extern` = `pnpm --filter <app> dev` in een eigen terminal · `mislukt` = zet tijdelijk een onzinnig `startCommand` in `appsConfig.ts` |
| **Guard tegenproeven** | Beide kanten van `blokkade()`: mét PM2 online moet cashflow's `dev` en `build` een reden teruggeven; met `pm2 stop cashflow` moeten ze `null` geven. Draai `pm2 start cashflow` daarna weer aan |
| **Loopback-weigering** | `curl -s -o /dev/null -w '%{http_code}' -H 'Host: 10.0.0.5:3010' http://127.0.0.1:3010/api/status` → verwacht `403`; zonder de Host-header `200` |
| **Flow aandrijven** | geen — er is nog geen flow-harness (`scripts/flow-harness.mjs`) zoals bij portfolio en jobradar. Eén scherm, geen navigatie; bouw hem als er routes bijkomen |
| **Invariant draaien** | geen — deze app rekent niets uit, hij meet en spawnt |

**Let op bij verifiëren:** `pm2 stop cashflow` legt de draaiende productieserver op :3000
plat. Doe dat alleen bewust en zet hem daarna terug aan — of toets de guard op de
andere kant door de PM2-staat te lezen in plaats van te veranderen.
