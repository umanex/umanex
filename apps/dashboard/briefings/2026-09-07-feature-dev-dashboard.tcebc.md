# TC-EBC — Dev-dashboard (umanex-apps launcher)

- **Datum:** 2026-09-07
- **Type:** feature
- **Project:** umanex-apps / apps/dashboard
- **Klant:** umanex (eigen werk)
- **Status:** gebouwd

---

```
TASK:        Eén lokale pagina die per app in de monorepo de status toont en de app
             kan opstarten en stoppen — rowtrack via een Terminal-tab, de Next.js-apps
             inline.

CONTEXT:     Nieuwe app `apps/dashboard` op :3010, lokaal-only, nooit naar Vercel.
             Vervangt het handmatig openen van een terminal, cd'en naar apps/<app> en
             het dev-commando uit de package.json opzoeken. Leest `apps/*/package.json`
             voor de scriptlijst; de poort- en modus-mapping staat in een statische
             config in de repo, niet afgeleid.

ELEMENTS:    Kaartenraster (één Card per app) · statusindicator (gestopt / draait /
             draait extern / start mislukt) · primaire start-stop-knop · scriptlijst
             per kaart (build, type-check, lint, storybook, test) · linkrij (localhost,
             Vercel, Figma, Storybook) · git-regel (branch, ahead/behind, vuile tree) ·
             globale ThemeToggle. Uit @umanex/ui: card, button, badge, separator,
             tooltip, theme-toggle.

BEHAVIOUR:   Poll elke 2s per app de configureerde poort op een luisterend proces.
             Start → POST naar een API-route die spawnt volgens `mode` uit de config:
             `inline` = detached child_process met output naar
             `apps/dashboard/.runtime/<app>.log`, `terminal` = osascript dat een
             Terminal-tab opent met cwd en commando. Stop → alleen mogelijk voor een
             pid die het dashboard zelf schreef in `.runtime/<app>.pid`. Een extern
             gedetecteerd proces krijgt géén stop-knop. Scriptlijst klapt uit in de
             kaart; een geblokkeerd script is disabled met de reden in een tooltip.

CONSTRAINTS: Desktop, muis + keyboard, geen mobiele layout. Light en dark via de
             gedeelde preset. Uitsluitend rollen uit @umanex/config/tailwind/preset —
             geen rauwe hex, geen paletklasse. Componenten uit @umanex/ui, geen lokale
             kopie, geen eigen Storybook. Geen auth, geen database, geen deploy-config:
             de API-routes voeren shell-commando's uit en mogen daarom nooit publiek
             bereikbaar zijn — server bindt op 127.0.0.1.
```

---

## Open vragen

Alle drie beantwoord op 2026-09-07:

1. **Scriptlijst-primitive** → een `DropdownMenu` toevoegen aan `packages/ui`, vanuit shadcn.
   Gedaan: `packages/ui/components/ui/dropdown-menu.tsx` + story, export en
   `@radix-ui/react-dropdown-menu` als dependency. **Restpunt:** de component heeft nog
   geen pagina in het Figma-bestand Component library, dus `pnpm --filter @umanex/ui
   figma:check` staat rood op twee assen (`[pagina]` en `[link]`). Zie Aannames.
2. **Poortbotsing** → `soda-plus` naar `:3005`; `rowtrack-web` houdt `:3004` (die claimde hem
   eerst, briefing 2026-08-09, en heeft een harness op `:3104`).
3. **Logpaneel** → niet nodig. Output van een inline start gaat naar
   `apps/dashboard/.runtime/<app>.log`, de exit-code naar `.exit`, en de kaart toont een
   foutstaat met die code. Package.json-scripts openen sowieso een Terminal-tab, dus daar
   is er geen blinde vlek.

## Aannames

- `[ASSUMPTION: poort 3010 voor het dashboard]` — vrij gemeten op 2026-09-07 (`lsof`).
- `[ASSUMPTION: rowtrack-commando]` — `npx expo start --dev-client`, niet het `start`-script.
- `[ASSUMPTION: git per kaart]` — branch en voor/achter zijn repo-breed en staan in de
  kopbalk; de kaart toont alleen het aantal gewijzigde bestanden in díe app-map. In een
  monorepo delen alle apps één HEAD, dus een "branch" per kaart zou zeven keer hetzelfde
  beweren.
- `[ASSUMPTION: scripts altijd in een Terminal-tab]` — niet inline. Een build of type-check
  wil je zien lopen, en het dashboard heeft bewust geen logpaneel. Afwijking van de
  oorspronkelijke opzet; zie Beslissingsgeschiedenis.
- **Openstaand, geen aanname:** de Figma-pagina voor DropdownMenu bestaat nog niet. De
  Desktop Bridge was tijdens deze sessie niet verbonden (`figma_get_status` →
  `No active file connected`), dus de node kon niet aangemaakt worden en er is géén geldige
  read-back van een verse edit. `figma:check` benoemt het gat; wegschrijven zou het
  onzichtbaar maken.

## Acceptatie

Gemeten op 2026-09-07 tegen de draaiende app op `http://127.0.0.1:3010`, met PM2 online
op `:3000` (cashflow, 9u uptime) — dus tegen de échte staat, niet tegen een fixture.

**Typologie**

- [x] Het dashboard serveert op `http://127.0.0.1:3010` vanuit `apps/dashboard` — bewijs: `curl -o /dev/null -w '%{http_code}'` → `200`
- [x] Geen bestaande app kreeg een dashboard-route — bewijs: `git status --porcelain -uall` raakt buiten `apps/dashboard` alleen `apps/soda-plus` (poort) en `packages/ui` (dropdown)
- [x] De server bindt niet op `0.0.0.0` — bewijs: `lsof -nP -iTCP:3010 -sTCP:LISTEN` → `127.0.0.1:3010`, niet `*:3010`
- [x] Een request met een niet-loopback Host-header wordt geweigerd — bewijs: `-H 'Host: 10.0.0.5:3010'` → `403` op `/api/status` én op `POST /api/start`; zonder die header `200`

**States**

- [x] Elke kaart toont een expliciete laadstatus vóór de eerste poll — bewijs: `curl / | grep -o 'meten…' | wc -l` → **7**, gelijk aan het aantal apps in de config
- [x] Een start met exit ≠ 0 zet de kaart in een foutstaat met die code — bewijs: `startCommand: 'exit 42'` → `state=mislukt laatsteExit=42`; `pnpm run dit-script-bestaat-niet` → `state=mislukt laatsteExit=1`
- [x] Een geslaagd commando geeft géén foutstaat — bewijs: `startCommand: 'true'` → `.exit` bevat `0`, `state=gestopt laatsteExit=None` (negatieve controle bij het vorige item)
- [x] Een app die draait zonder pidbestand van het dashboard toont "extern" — bewijs: `pnpm dev` buiten het dashboard op `:3002` → `state=extern owner=extern pid=None`
- [x] Empty-state n.v.t. — de app-lijst is statisch en per constructie nooit leeg — bewijs: `APPS` in `lib/appsConfig.ts` is een literal met 7 entries, geen `readdirSync` over `apps/`

**Interactie**

- [x] Start, Stop en Scripts zijn met Tab bereikbaar — bewijs: Playwright, 40× Tab → 10 unieke focusdoelen, waaronder `BUTTON:Start`, `BUTTON:Stop`, `BUTTON:Scripts`
- [x] De Start-knop is met Enter te activeren — bewijs: `focus()` + `keyboard.press('Enter')`, geen klik; de vyvey-kaart (1 kaart, 1 Start-knop, geteld vóór het aflezen) ging naar `startend` met `gestart (pid 85164)`
- [x] Het scriptmenu opent met Enter en is met de pijltjes te bedienen — bewijs: Enter → `role=menu` met 4 items, ArrowDown focust `type-check`, Escape sluit en geeft focus terug aan `Scripts`
- [x] Geen actie is uitsluitend via hover, drag of swipe bereikbaar — bewijs: alle 15 knoppen zijn `<button>`/`<a>`; de blokkade-reden staat als tekst in het item en in de kaart, niet in een tooltip

**Edge cases**

- [x] De cashflow-kaart heeft geen stop-knop zolang PM2 het proces bezit — bewijs: `/api/status` → `owner=pm2 ownerLabel=cashflow`; de render toont een uitgeschakelde Start en geen Stop
- [x] Het cashflow-`dev`-script is niet startbaar zolang PM2 online is — bewijs: `startGeblokkeerd` = "PM2 (cashflow) serveert uit deze map — dit script wist .next en breekt die server."
- [x] Het cashflow-`build`-script is disabled zolang HEAD niet op `main` staat — bewijs: menu-item `build` heeft `data-disabled` en draagt de reden als tekst
- [x] Beide guards vuren én zwijgen — bewijs: `pnpm --filter dashboard test` → 7 gevallen groen, met de "zonder PM2"- en "op main"-kant erbij; mutatietest: branch-conditie weggehaald → exit 1, regex van regel 1 gebroken → exit 1, na herstel exit 0 bij gelijke md5
- [x] rowtrack start in een Terminal-tab, niet inline — bewijs: `POST /api/script {rowtrack,test}` → Terminal-vensters 3 → 4, juiste cwd, 57 tests gedraaid
- [x] Een tweede klik op start geeft geen tweede proces — bewijs: tweede `POST /api/start` → `ok:false`, "dit dashboard heeft hier al een proces draaien"
- [x] `rowtrack-web` en `soda-plus` hebben elk een eigen poort — bewijs: `package.json` → `3004` resp. `3005`; `grep -rn 3004` toont geen soda-plus meer
- [x] Een inline gestart proces overleeft een herstart van de dashboard-server — bewijs: dashboard pid 76504 gekild; vyvey pid 77464 bleef luisteren op `:3002` met HTTP `200`, en het herstarte dashboard herkende hem weer als `owner=dashboard`
- [x] Een stop haalt de hele procesgroep om, niet enkel de shell — bewijs: `POST /api/stop` → shell 77263 én `next` 77464 beide weg, `:3002` vrij
- [x] Een stop op een verdwenen pid crasht niet — bewijs: tweede `POST /api/stop` → `ok:false`, "geen eigen proces om te stoppen"
- [x] Een stop raakt een extern proces niet aan — bewijs: `POST /api/stop` op een buiten het dashboard gestarte vyvey → geweigerd, `:3002` bleef luisteren op pid 78999
- [ ] Een gewéigerde osascript-automatisering toont de macOS-permissietekst — `[NIET TE VERIFIËREN — de automation-permissie is niet in te trekken zonder Systeeminstellingen te wijzigen]`. Wél gemeten: de catch-tak vuurt en geeft `ok:false` met de osascript-stderr, zonder dat er een tab opent (Terminal-vensters bleven 4); dat was een syntax-fout (−2741), niet de permissiefout (−1743), dus de specifieke tekst is ongetoetst

**Behaviour / constraints**

- [x] De statusindicator volgt het werkelijk luisterende proces — bewijs: een app buiten het dashboard starten liet de kaart binnen één poll (2s) naar `extern` gaan; stoppen liet hem naar `gestopt` gaan
- [x] `apps/dashboard/CLAUDE.md` bevat een `## Verify-pad`-sectie — bewijs: `pnpm ds:guard` leest hem; de sectie staat op regel 47
- [x] `apps/dashboard/CLAUDE.md` bevat een `## Design-systeem-bron`-sectie — bewijs: `pnpm ds:guard` → "8/8 apps gedeclareerd en in lijn met de schijf"
- [x] `apps/dashboard` importeert `@umanex/ui` in app-code, niet enkel in `scripts/` — bewijs: 5 bestanden onder `app/` en `components/`, en er is geen lokale `components/ui/`
- [x] `pnpm --filter @umanex/tokens guard` slaagt — bewijs: "laag-discipline: 227 bestanden schoon (0 baseline-uitzonderingen)"
- [x] `pnpm --filter dashboard type-check` is groen — bewijs: `tsc --noEmit` zonder output
- [x] `pnpm --filter dashboard lint` is groen — bewijs: "No ESLint warnings or errors" (inclusief `@umanex/config/eslint/tokens`)
- [x] `apps/dashboard` heeft geen `vercel.json` — bewijs: `ls apps/dashboard/vercel.json` → bestaat niet
- [x] De kaart rendert leesbaar in beide modes — bewijs: Playwright-screenshots, `body-bg` `rgb(255,255,255)` light tegen `rgb(12,17,29)` dark, beide met alle 7 kaarten uit de laadstaat
- [ ] `pnpm --filter @umanex/ui figma:check` is groen — **rood**, op `[pagina] component in Storybook zonder Figma-pagina: DropdownMenu` en `[link] URL heeft geen node-id`. De Desktop Bridge was niet verbonden, dus de pagina kon niet aangemaakt worden. Het gat staat expliciet in de guard in plaats van weggeschreven

## Beslissingsgeschiedenis

- 2026-09-07: Startmechanisme vastgelegd als per-app configureerbaar (`inline` vs `terminal`) in plaats van één uniform mechanisme — Expo's dev-client vraagt een TTY voor `i`/`r`/`a`, een inline child process levert die niet.
- 2026-09-07: Vorm vastgelegd als eigen app `apps/dashboard` in plaats van een route in een bestaande app — de API-routes voeren shell-commando's uit en horen niet in een codebase die naar Vercel deployt.
- 2026-09-07: Logpaneel uit scope op keuze van Jeroen; output naar `.runtime/<app>.log` toegevoegd zodat een gefaalde inline start niet stil verdwijnt.
- 2026-09-07: **Package.json-scripts openen altijd een Terminal-tab**, ook bij een app in `inline`-modus. Een build of type-check wil je zien lopen, en zonder logpaneel zou de uitkomst anders nergens landen. De modus uit de config geldt dus alleen voor de start-knop.
- 2026-09-07: Exit-code wordt weggeschreven via `trap … EXIT` in plaats van `<commando>; echo $?`. Die tweede vorm miste elke exit-code van een commando dat de shell zelf beëindigt — gemeten met `exit 42`: geen `.exit`-bestand, en de kaart bleef op "gestopt" alsof er niets misging.
- 2026-09-07: De statuspunt voor `extern` ging van `bg-primary` naar `bg-success/40`. Primary is umanex-rood en las op de render als een fout, terwijl een externe server gewoon draait.
