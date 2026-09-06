# BACKLOG.md — gemeld, niet gebouwd

Dit bestand vangt het werk dat **buiten scope** viel: wat er benoemd is maar niet gedaan, plus de P3-bevindingen uit `ux-audit` en `security-audit`. Zonder deze lijst is "buiten scope gelaten" alleen een zin in een antwoord dat wegscrollt — de melding bestaat dan wel, het werk niet, en niemand kan er later op terugkomen.

Entries komen erbij **op het moment van de melding**, niet aan het einde van de sessie. Een sessie die zonder reflectie afloopt mag geen scope-drop verliezen; dat is precies de vorm waarin ze vandaag verdwijnen.

## Waarom dit geen HANDOFF is

Een handoff-item is **sessie-gebonden**: het zorgt dat de volgende sessie niet koud begint en verdwijnt zodra het opgepakt is. Een backlog-item is **werk** — het blijft bestaan tot het gebouwd of bewust verworpen is, ook als er tien sessies overheen gaan. Ze in één bestand gooien maakt het sessiestart-signaal onbruikbaar: de handoff-lijst hoort kort te zijn, een backlog mag lang worden.

| Soort bevinding | Huis |
|---|---|
| Werk dat benoemd is maar niet gebouwd (scope-drop) | **hier** |
| P3 / nice-to-have uit `ux-audit` of `security-audit` | **hier** |
| Waargenomen fout van een skill of werkprincipe | `LEARNINGS.md` (via `vastleggen`) |
| Onzekerheid, aanname, risico, next-step van déze sessie | `HANDOFF.md` (via `sessie-reflectie`) |
| Durend feit over Jeroen of het project | auto-memory |

## Statussen

- `open` — vastgelegd, nog geen beslissing over genomen. Telt mee bij sessiestart.
- `gepland` — dit gebeurt; het wacht op een plek in de planning.
- `gebouwd` — gedaan. Blijft staan als spoor, met commit of PR erbij.
- `verworpen` — bewust niet doen. **Reden verplicht**, anders komt hetzelfde voorstel over drie maanden terug en begint de afweging van nul.

## Types

`feature` · `refactor` · `fix` · `test` · `infra` · `ux` · `security` · `docs`

## Format

Elke entry staat onder een laag-header (`# Globaal`, `# Klant — {naam}`, `# Project — {app}`) en heeft deze vorm:

    ## YYYY-MM-DD — {korte titel} · [{type}]
    - **Wat:** {1-2 zinnen — wat er gebouwd zou worden}
    - **Waarom niet nu:** {waarom het buiten scope viel}
    - **Eerste zet:** {concreet startpunt of "-"}
    - **Status:** open

<!-- De eerste entry maakt hieronder de juiste laag-header aan. -->

# Project — cashflow

## 2026-08-25 — Het Ctrl+C-venster dat PR #314 als gesloten rapporteert, staat nog open · [fix]
- **Wat:** `scripts/flow-harness.mjs` registreert zijn SIGINT/SIGTERM-handler op r1102–1103, *ná* `const server = await startServer()` op r1088. Tijdens de spawn plus de readiness-lus (`detached: true` op r362, poll per 250 ms tot een deadline van 60 s op r369) bestaat er dus géén handler. Ctrl+C in dat venster laat de detached `next start` als wees op `:3100` achter — precies het geval dat de PR-body van #314 beschrijft als *"Gemeten ná: 0 listeners in beide vensters, exit 130 (INT) / 143 (TERM)"*. Het `gebouwd`-item hierboven neemt die claim over. Wat wél gemeten is en klopt, is het browser-venster (`chromium.launch()` binnen de `try`); het server-startvenster is een ander venster en is niet gedekt.
- **Waarom niet nu:** Buiten de scope van "314 mergen". De bevinding komt uit een pre-merge risicopanel (drie lenzen + adversariële verificatie, 2026-08-25); de verifier probeerde hem op drie routes te weerleggen en alle drie vielen om. Niet merge-blokkerend: het raakt alleen de lokale harness, nooit `.next` of de PM2-app.
- **Eerste zet:** De `process.once('SIGINT'/'SIGTERM', bijSignaal)`-registratie vóór `startServer()` zetten, met een `server`-referentie die op dat moment nog `null` mag zijn. Tegenproef die het defect zélf draagt: start `pnpm --filter cashflow flow --no-build` en stuur SIGINT zodra `next start` gespawnd is maar vóór de "serveert …"-regel verschijnt; eis 0 listeners op `:3100` en exit 130. Draai diezelfde proef eerst op de huidige code — hij moet daar rood worden, anders meet hij het verkeerde venster.
- **Status:** open

## 2026-08-25 — `pm2:rebuild` is env-gevoelig geworden en kan stil naar de verkeerde map bouwen · [risico]
- **Wat:** Sinds #314 is `distDir: process.env.NEXT_DIST_DIR ?? '.next'`. `pm2:rebuild` (`next build && pm2 restart cashflow`) erft de shell-omgeving. Staat `NEXT_DIST_DIR=.next-harness` nog geëxporteerd — plausibel na handmatig harness-debuggen, want dat is exact de variabele die de nieuwe docs noemen — dan schrijft `next build` naar `.next-harness` en herstart PM2 op de ónveranderde `.next`. Exit 0, geen enkele melding, en de "rebuild" heeft niets gedeployed. Gemeten: PM2's eigen omgeving (`~/.pm2/dump.pm2`, 48 sleutels) bevat `NEXT_DIST_DIR` niet, dus de fout kan alleen uit de shell van degene die bouwt komen.
- **Waarom niet nu:** De rebuild van 2026-08-25 is bewust met een expliciete `NEXT_DIST_DIR=.next` gedraaid en geverifieerd (oude BUILD_ID `6549Nf…` → 404, nieuwe `SDbo0Fbb…` → 200). Het gat zit in het script, niet in die run.
- **Eerste zet:** `"pm2:rebuild": "NEXT_DIST_DIR=.next next build && pm2 restart cashflow"` — de map die PM2 serveert expliciet vastzetten in plaats van hem uit de omgeving te laten komen. Zelfde overweging voor `build`.
- **Status:** open

## 2026-08-25 — De harness bouwt 16 s vóór hij merkt dat `:3100` bezet is · [refactor]
- **Wat:** In `scripts/flow-harness.mjs` staat `if (BOUWEN) await bouw();` op r1076 en de enige poortcheck (`poortBezet()`, r278/r346) pas binnen `startServer()` op r1088. Een tweede harness-run naast een lopende eerste doet dus eerst een volledige build en breekt daarna af op "poort bezet" — een fout die met één fetch van ~1,5 s vooraf bekend was.
- **Waarom niet nu:** Kost alleen tijd; raakt `.next` niet en is niet merge-blokkerend. Op main vóór #314 bestond `bouw()` niet, dus de poortcheck was de facto de eerste zware actie — de regressie komt met de nieuwe bouwstap mee.
- **Eerste zet:** `poortBezet()` naar voren halen, vóór `if (BOUWEN)`. Tegenproef: laat iets op `:3100` luisteren, draai `flow` en eis dat hij binnen enkele seconden afbreekt zonder dat `.next-harness/BUILD_ID` van datum verandert.
- **Status:** open

## 2026-08-25 — flow-harness deelt `.next` met de PM2-app · [test]
- **Wat:** `scripts/flow-harness.mjs` bouwt bewust niet (zijn eigen check: *"een build overschrijft de .next waar een draaiende server uit leest"*) en serveert `apps/cashflow/.next` op `:3100` — dezelfde map waar PM2 op `:3000` uit leest. Dat was sluitend zolang cashflow in een eigen zusmap-worktree met een eigen `.next` stond; sinds app-werk in de hoofdtree gebeurt (2026-08-25) toetst de harness op een feature branch alleen de laatst gebouwde staat, en een `next build` om de eigen wijziging te toetsen breekt de draaiende server (gemeten 2026-08-07). Gevolg: het verify-pad "flow-harness op `:3100`" uit de globale laag (`.umanex-os/CLAUDE.md` → Git workflow → Parallel werk) geldt hier alleen voor de gebouwde `main`; feature-werk valt terug op CI.
- **Waarom niet nu:** De fix raakt `next.config.mjs` (config — vooraf bevestigen) en verandert het gedrag van `pnpm --filter cashflow flow`; buiten de scope van docs-PR #306.
- **Eerste zet:** `distDir: process.env.NEXT_DIST_DIR ?? '.next'` in `next.config.mjs`; de harness bouwt zélf met `NEXT_DIST_DIR=.next-harness` en spawnt `next start` met dezelfde env; `.next-harness/` in `.gitignore`; de `BUILD_ID`-check en de chunk-scan van de harness verhuizen naar die map. Tegenproef: `pnpm --filter cashflow flow` op een feature branch terwijl PM2 draait — `:3000` serveert vóór en ná dezelfde `BUILD_ID`, en een bewust gebroken scenario op de branch wordt rood op `:3100`.
- **Status:** gebouwd — 2026-08-25, branch `feature/cashflow-harness-distdir`. Tegenproef gemeten in een tijdelijke tree terwijl PM2 uit de hoofdtree serveerde: `pnpm --filter cashflow flow` bouwde in 16 s in `.next-harness` (BUILD_ID `Kd9L5l…`), 10/10 groen, géén `.next` aangemaakt, `tsconfig.json` niet door Next herschreven; `--selftest --no-build` 19/19 op dezelfde build; label "Opnieuw proberen" op de branch gewijzigd → nieuwe BUILD_ID `_7FJaQr9…`, `state — fout` rood (exit 1), dus de harness rijdt branch-code; `--dist=.next` zonder build en `--no-build` zonder harness-build weigeren elk met hun eigen boodschap en maken niets aan. `:3000` serveerde vóór en ná `_buildManifest.js` van BUILD_ID `6549…` (200) en `.next/BUILD_ID` in de hoofdtree hield zijn datum (10 aug. 13:36). Daarna on-target in de hoofdtree zelf, naast PM2 (pid 1432) uit dezelfde map: build 15 s, BUILD_ID `1qy2iS…`, 10/10, `.next/BUILD_ID` en `:3000` ongewijzigd. Review-panel (drie lenzen, 2026-08-25) leverde één P1: `--dist` was vrije invoer en `next build` maakt de doelmap leeg (`--dist=.` zou `apps/cashflow` wissen, `--dist=.NEXT` op APFS `.next` zelf) → allowlist van twee namen in `scripts/harness-dist.mjs`, getoetst zonder bijwerkingen (acht vormen geweigerd, exit 2 vóór enige spawn); verder symmetrische tsconfig-`exclude` (0 harness-types in de `tsc`-lijst), een manifest-check dat `:3100` echt de gebouwde BUILD_ID serveert (zonder env 404, mét env 200) en de server die bij een browser-fout niet meer als wees achterblijft (0 listeners).

## 2026-09-06 — Bufferpot kan negatief staan zonder dat "niet gedekt" dat meldt · [fix]
- **Wat:** Een betaling die volledig uit de bufferpot komt en groter is dan de potstand duwt `potBalance` onder nul terwijl `deficitUncovered` op 0 blijft en `endBalance` positief is (gemeten: pot −8.500, uncovered 0,00, eindsaldo +500). Dat is hetzelfde beeld dat `briefings/2026-08-05-feature-buffer-sweep-footer.tcebc.md:121-123` als opgelost noteert; die fix (`calculator.ts:496-499`) hangt aan `hasCashOverflow` en dekt de betaling zónder cash-deel niet. Bereikbaar via `setDeficitBuffer` (geen guard, `store/cashflow.ts:150-157`) of via `onMovePayment` naar een maand met een kleinere potstand — de betaalmodal weigert het wél (`ReservationPaymentModal.tsx:94-99`).
- **Waarom niet nu:** Buiten de scope van de positie-afleiding, en pre-existing. Het raakt haar wél: dit is de enige gemeten toestand waarin `positie ≠ −niet gedekt`, en de nieuwe invariant in `scripts/buffer-scenarios.ts` sluit hem daarom expliciet uit met `b.total > -0.005`.
- **Eerste zet:** Een scenario dat de toestand vastlegt (pot 1.500, betaling 9.000 volledig `fromReservation`), dan de oorzaak: `nextDeferred` en `nextPotBalances` lopen bij een betaling zonder cash-deel uiteen. Verruim de guard in de suite niet — die zou het defect wegdefiniëren.
- **Status:** open

## 2026-09-06 — Cash-bijbetaling op de bufferpot verliest de potstand · [fix]
- **Wat:** `hasCashOverflow` zet het potsaldo hard op 0 (`calculator.ts:381-385`) terwijl `subtotals.buffer` de volle stand als kost blijft boeken. Gemeten in de ankermaand: €50 verschil in de invoer (een betaling mét of zónder cash-deel) geeft €12.000 verschil in de bufferpositie, in alle drie de maanden van het venster. Spreekt de aanname in `briefings/2026-08-05-feature-buffer-sweep-footer.tcebc.md:62-63` tegen — "bestaande betalingen op de bufferpot blijven correct doorrekenen (ze verlagen de pot)": bij een cash-deel verlaagt de betaling de pot niet, ze zet hem op nul.
- **Waarom niet nu:** Alleen bereikbaar via legacy-data — de bufferpot staat sinds 2026-08-05 niet meer in de betaalmodal, dus nieuwe betalingen op die pot kunnen niet meer ontstaan. Jeroens huidige document heeft er geen.
- **Eerste zet:** Scenario S19 uitbreiden met de positie als assertie (die is er nu niet), dan beslissen of de nul-zetting op `potBalances` klopt of dat alleen het cash-deel eraf moet.
- **Status:** open

## 2026-09-06 — De ankermaand-asymmetrie in `subtotals` · [refactor]
- **Wat:** `subtotals.buffer` is in de ankermaand een *stand* (het banksaldo bevat de hele pot) en in latere maanden een *stroom*; `deficitUncovered` is een tweede naam voor `−endBalance`. Daardoor is "Deze maand" niet uit `subtotals` af te leiden en gebruikt `bufferSummary.movement` `netBurn`. Gemeten: `subtotals.incoming − recurring − oneOff − budgets − provisions` wijkt in 6 van 19 scenario's af van de maandstroom, telkens met exact `|startBalance|`.
- **Waarom niet nu:** Echte modelschuld, maar niet de oorzaak van de klacht die de positie-afleiding oploste. Aflossen betekent de vier clamps in `calculator.ts`/`subtotals.ts` herschrijven plus de hercontrole in `buffer-scenarios.ts` die dezelfde clamps draagt — dat hoort een eigen taak te zijn met een eigen invariantenset, geen bijvangst van een footerregel.
- **Eerste zet:** Eerst de invariant kiezen die de asymmetrie zou vastleggen (een kostenkop die in élke maand een stroom is), pas daarna de clamps aanraken. Zie de meting in de beslissingsgeschiedenis van `briefings/2026-09-06-feature-negatieve-bufferstand.tcebc.md`.
- **Status:** open
