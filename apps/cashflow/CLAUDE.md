# CLAUDE.md — cashflow app

## Server management

De cashflow app draait als production server (`next start --port 3000`), beheerd door **PM2** (app-naam `cashflow`, `autorestart: true`, config in `ecosystem.config.js`). Het is **geen** `next dev` — de browser ziet de vooraf-gebouwde `.next`, niet je live source.

### Harde regel: na elke code-wijziging build + PM2 restart

Een source-wijziging is pas zichtbaar op localhost na een nieuwe build én een PM2 restart:

```bash
pnpm --filter cashflow build && pm2 restart cashflow
```

Beide commando's staan in de allowlist van `.claude/settings.local.json`. Daarna in de browser een **hard refresh** (Cmd+Shift+R) — het open tabblad heeft de oude chunk-hashes nog gecached.

**Reden:** `next start` serveert chunks met content hashes. Na een rebuild zijn die hashes veranderd; een lopende server kent alleen de oude hashes en geeft `ChunkLoadError` in de browser. Hard refresh van het tabblad alleen volstaat niet — de server zelf moet de nieuwe build laden.

**Niet manueel killen.** PM2 `autorestart` respawnt het proces direct, en een handmatige `pnpm start &` ernaast geeft een tweede, conflicterende server op dezelfde poort. Gebruik altijd `pm2 restart cashflow`.

Logs: `pm2 logs cashflow` of `/Users/jeroen/.pm2/logs/cashflow-{out,error}.log`.

---

## Geen dark mode

Cashflow draait uitsluitend in light. Beslissing van Jeroen op 2026-08-08; de app is een
persoonlijke tool op één scherm en een tweede mode leverde alleen onderhoud op. Er is dus geen
theme-class, geen `ThemeToggle` en geen theme-init-script — bouw ze niet terug.

De gedeelde lagen blijven ongemoeid: `@umanex/tokens` houdt zijn `Theme/dark` en `Semantic/dark`
sets (portfolio, vyvey en jobradar gebruiken ze), `packages/ui` houdt zijn `ThemeToggle`, en
`darkMode` blijft in de gedeelde Tailwind-preset staan. Wat hier weg is, is de *aanroep* — de
`.dark`-blokken in `theme.css` worden in deze app nooit aangezet.

Gevolg voor verificatie: `render-screens.tsx` rendert één kolom en `dom-sweep.mjs` labelt geen
mode meer. Een contrastcijfer voor cashflow gaat dus altijd over light.

---

## Design-systeem-bron

Welke laag deze app zijn vorm van krijgt. Gemeten, niet afgeleid: `scripts/design-system-guard.mjs`
toetst elke regel hieronder tegen wat er op schijf staat. "geen" is overal een geldig antwoord,
mits het er staat.

- **Preset:** `@umanex/config/tailwind/preset`
- **Componentbron:** `@umanex/ui`
- **Storybook:** `pnpm --filter @umanex/ui storybook` (:6006)

De modals (`ReservationPaymentModal`, `RepeatMonthModal`) draaien op `Button`, `Input` en `Label`
uit `@umanex/ui`. Een nieuwe primitive hoort in `packages/ui` met een story ernaast, niet hier.

**De rest van de app niet, en dat is gemeten.** Van de 96 hand-gerolde primitives in deze app
zijn er 2 een schone swap, 58 te dicht voor elke bestaande maat, en 36 helemaal geen knop of
veld (drag-handles, glyph-affordances, een klikbare rij). De app-body werkt op `h-7`/`h-8` met
`text-dense`, `rounded-sm` en `focus:ring-1`; `Input` kent alleen `h-10` en `Button` alleen
`h-9`/`h-10`/`h-11`. Een swap daar kost vier tot zes overschrijvende klassen per call-site en
levert een primitive op die tegen zijn eigen defaults vecht — slechtere code dan wat er staat.

De echte oplossing is een **compacte maat in `packages/ui`**, niet meer overrides hier. Dat is
een design-system-wijziging (bevestiging van Jeroen) én een Figma-herbouw, want
`pnpm --filter @umanex/ui figma:check` faalt hard op een variant-as die code en Figma niet delen.
Staat als open item in de root-`BACKLOG.md`.

Wat de migratie van de modals zichtbaar veranderde, alle drie beslissingen van de rollaag en niet
van deze app: de veldlabels werden 6px korter per regel (`Label` draagt `leading-none`, de
call-sites hadden de `text-sm`-regelhoogte van 20px), de focus-ring werd `focus-visible` mét
2px offset in plaats van `focus` zonder, en de Annuleren-knop hovert nu naar `bg-accent` — de
bleke merktint — in plaats van naar `bg-muted`. Dat laatste is precies de inconsistentie die
deze app tegenover jobradar had.

---

## Verify-pad

Wat de `verify`-skill hier kan uitvoeren. Vastgesteld 2026-08-07 door alle vijf te draaien, niet door
ze af te leiden. Staat er "geen", dan is dat een gat dat gebouwd moet worden — geen vergetelheid.

| Capability | Commando / status |
|---|---|
| **Render vastleggen** | Twee drivers, één meting (`scripts/contrast.mjs`). Statisch: `pnpm --filter cashflow verify:visual` rendert de rollaag en de charts naar `.screens-preview.html` / `.charts-preview.html` — geen server, geen sessie — en sweept ze op contrast (302 tekstelementen). Draaiend: `pnpm --filter cashflow flow` sweept het échte scherm mét `MonthCard` en beide modals open (325 tekstelementen). Statisch hermeten 2026-09-06 (de footer verloor zijn regel "Niet gedekt" en `RunwayCard` kreeg zijn negatieve stand als vijfde fixture: 297 → 302); draaiend ongewijzigd op 325, want de contrast-scenario's draaien op de fixture zónder bufferpot. Beide alleen light — zie "Geen dark mode". Meekijken: `flow --headed`, of de draaiende app op `http://localhost:3000`. |
| **Flow aandrijven** | `pnpm --filter cashflow flow` — Playwright rijdt twaalf scenario's uit tegen een build die de harness zelf maakt in `.next-harness` (zie *Verse build*): de sleep tussen twee maandkolommen (toetsenbord én muis), de contrast-sweep op scherm + modals, het openen en met Escape sluiten van beide modals, de a11y-staat van de twee sidepanels (dicht = `inert` en uit de a11y-tree, open = bereikbaar), de twee saldoregel-scenario's (staat hij bínnen de inkomstensectie en is alleen de ankerkolom bewerkbaar · verdwijnt hij uit een latere maand zodra het saldo nul is), de maandfooter met een bufferpot die het tekort niet meer draagt (`gedrag: { buffer: true }` — kolom 2 hoort een negatieve stand te tonen naast de volle maandstroom en kolom 0, een half verstreken maand, géén bedrag — met "Buffer" direct achter "Deze maand") en zijn tegenhanger op de standaardfixture (geen bufferpot → de hint "Geen buffer" in alle drie de kolommen en nergens een bedrag) en de drie states hieronder. Start zijn eigen `next start` op **3100** en weigert te draaien als daar al iets luistert. `--selftest` voegt elf tegenproeven toe die hóren te falen (script `flow:selftest`: bouwt óók zelf), `--headed` laat meekijken, `--port=` wijkt uit; Ctrl+C ruimt de server op. Bouwt zelf in `.next-harness` en erft daarbij zijn eigen `NEXT_PUBLIC_SUPABASE_URL`; `--no-build` hergebruikt de vorige harness-build, `--dist=.next` serveert een bestaande build zonder te bouwen — elke andere naam weigert hij, want `next build` maakt de doelmap eerst leeg. Een hergebruikte build moet met **dezelfde** `NEXT_PUBLIC_SUPABASE_URL` gemaakt zijn: de harness leest de origins uit `<distDir>/static/chunks` en weigert te starten bij een mismatch — vóór de server, vóór de browser — en toetst ná de start dat `:3100` echt díe BUILD_ID serveert. Draait sinds 2026-08-08 in `ci.yml`, sinds 2026-08-25 als `flow:ci` (`--selftest --dist=.next`, de build van de stap ervoor). Moet je juist de échte data zien, dan is er het handmatige recept onderaan — daar geldt de schrijf-discipline wél. |
| **State forceren** | Het `gedrag`-argument van de route-handler in `scripts/flow-harness.mjs`: `vertragingMs` (skeleton met `aria-busy`), `leeg` (geldig document zonder posten → de lege staat per sectie), `documentStatus: 500` (het foutscherm met "Opnieuw proberen") en sinds 2026-09-06 `buffer` (een bufferpot plus een kost die de pot ver overstijgt, zodat de maandfooter zijn drie standen toont: opbouw, stilstand, negatief). Alle vier hebben een eigen scenario. De fixture zelf: één post met een uniek bedrag in de eerste van drie kolommen, plus één spaarpot — zonder pot bestaat de betaalmodal niet. De `buffer`-variant vervangt die spaarpot door één bufferpot; de andere scenario's raakt dat niet. **Geen testaccount:** er is één Supabase-gebruiker en dat is Jeroens echte data. `scripts/seed-supabase.mjs` is géén verify-pad — dat is een one-off migratie die naar productie schrijft. |
| **Invariant draaien** | `pnpm --filter cashflow scenarios` (≈4s) draait beide suites — buffer 831/831 en anker 48/48 — plus een tegenproef per suite: die draait hem eerst met `SCENARIO_SELFTEST=1`, wat één check injecteert die móet falen. Een suite die dan tóch groen is, laat de hele stap vallen. Geen `&&`-keten: een rode buffer-suite verbergt de anker-suite niet meer. Staat sinds 2026-08-08 in `ci.yml`; los te starten met `scenarios:buffer` / `scenarios:anchor`. `calc-baseline.ts` blijft handwerk: hij dumpt een digest vóór en ná een refactor en een lege diff bewijst dat geen enkel getal verschoof — dat heeft geen pass/fail en hoort dus niet in een pipeline. Alle drie pure berekening, geen netwerk. |
| **Verse build** | Twee doelwitten, houd ze uit elkaar. De PM2-app op **:3000** draait uit de hoofd-tree en serveert `.next`, niet je source: toets met `find app components lib store -newer .next/BUILD_ID` — leeg betekent actueel. Na een wijziging `pnpm --filter cashflow pm2:rebuild`, daarna hard refresh. De flow-harness (`pnpm --filter cashflow flow`) bouwt zélf, in `.next-harness` (`NEXT_DIST_DIR`, zie `next.config.mjs`), en serveert die build op `:3100` — hij bouwt nooit in `.next` en raakt `:3000` dus niet. Dat is het verify-pad voor feature-werk in de hoofdtree; hij logt welke `BUILD_ID` hij serveert. `--no-build` hergebruikt de vorige harness-build, `--dist=.next` serveert een bestaande build zonder te bouwen (wat CI doet via `flow:ci`). |

**`pm2 status` is geen bewijs dat de app draait.** Op 2026-08-07 stond cashflow op `online` terwijl er
niets op poort 3000 luisterde: PM2's opgeslagen procesdefinitie wees nog naar de root-binary
`node_modules/.bin/next`, die er onder pnpm's isolated layout niet meer is. Herkenbaar aan `pid N/A`
en `mem 0b` bij status `online`. Toets daarom de poort, niet de status —
`lsof -nP -iTCP:3000 -sTCP:LISTEN`, of `curl -s -o /dev/null -w '%{http_code}' localhost:3000`.
Herstellen is de definitie herladen, niet herstarten:
`pm2 delete cashflow && pnpm --filter cashflow pm2:start && pm2 save`. Zonder die `pm2 save` haalt een
`pm2 resurrect` de dode definitie terug.

**Destructieve paden — de harness kan er niet bij.** Drie lagen, want een veiligheidsgarantie die
op één check rust, rust op te weinig. (1) Vóór de start vergelijkt hij de origins in
`<distDir>/static/chunks` met de origin die hij afsluit en weigert bij een mismatch — anders zou de app
langs de onderschepping heen naar een échte server gaan en zou "0 lekken" een lege bewering zijn.
(2) Élk verzoek naar die origin wordt onderschept: wat de harness kent (login, document, snapshots,
de wegschrijf-call) beantwoordt hij uit de fixture, al het overige breekt hij af en telt hij als lek,
en één lek laat de run vallen. (3) Elke ándere host die naar Supabase ruikt, wordt sowieso
afgebroken en geteld. Ook een
geslaagde verplaatsing schrijft dus niets weg — de PATCH die de app dan stuurt, verschijnt in de
teller "schrijfpogingen onderschept". Richt hem nooit op :3000: daar draait de app mét jouw echte
sessie en echte data. De poortcheck weigert dat al, maar de reden hoort hier te staan. Zie rail 5 in
de `verify`-skill.

### Recept — een dnd-kit sleep met de hand aandrijven zonder iets te schrijven

Voor het geval je de sleep op de échte data moet zien in plaats van op de fixture. Gemeten
2026-08-07 op de draaiende app, zonder één schrijfactie.

**Welke paden gegarandeerd niets schrijven.** Er is één `onDragEnd`, in `CashflowDndContext.tsx`; de
secties gebruiken enkel `useDraggable` en alleen `MonthCard` is droppable. Die handler schrijft
uitsluitend wanneer `sourceMonth !== targetMonthKey`. Dus: **Escape tijdens de sleep** (→
`handleDragCancel`, doet alleen `setActiveItem(null)`) en **loslaten binnen dezelfde maandkaart** (→
early return) zijn allebei bewijsbaar schrijfvrij. Loslaten boven een *andere* maand is dat niet —
doe dat nooit op dit account.

**Observeer de aria-live-narratie, niet de DragOverlay.** dnd-kit vertelt zijn eigen levenscyclus in
`[aria-live]`: *"Picked up draggable item …"* → *"… was moved over droppable area month-2026-09"* →
*"Dragging was cancelled"*. Dat is het betrouwbare signaal. De DragOverlay is dat níet: bij een sleep
die in één burst afloopt commit React hem nooit, dus een observer die op de overlay let meldt nul
terwijl de sleep wél is opgepakt.

**Het instrument.** `left_click_drag` levert wel degelijk pointer-events af (gemeten: 1 pointerdown,
3 pointermove, 1 pointerup) en dnd-kit pakt het item ook echt op. Wat ontbreekt is *tijd*: alles valt
in één burst, dnd-kit krijgt geen frame om de droppables op te meten, `over` blijft dus `null` en
`onDragEnd` returnt vroeg. Vandaar het beeld "opgepakt maar onverplaatsbaar". Drijf de sleep daarom
aan met losse `PointerEvent`s en een wachttijd per stap:

    pointerdown op [aria-roledescription="draggable"]
    → 8 × pointermove richting het doel, ~50 ms ertussen
    → keydown Escape          (nooit pointerup boven een andere maand)

Dezelfde reden zit in de harness ingebakken: `page.mouse.move(..., { steps })` in plaats van één
sprong, plus een korte beweging om de 8px-drempel van de `PointerSensor` te passeren.

**Het tabblad moet zichtbaar zijn.** In een achtergrond-tabblad is `document.visibilityState`
`hidden` en vuurt `requestAnimationFrame` niet meer. Een wachtlus op `rAF` hangt dan tot de
tool-timeout, en de DragOverlay blijft na afloop in de DOM staan omdat zijn exit-animatie geen frames
krijgt. Gebruik `setTimeout` als wachtmechanisme, of breng het tabblad naar de voorgrond.

**Bewijs achteraf dat er niets geschreven is.** Vergelijk `document.body.innerText` met een baseline
van vóór de sleep, maar filter eerst de aria-live-regels weg — die veranderen wél. Sluitender: herlaad
de pagina (verse fetch uit Supabase) en vergelijk dan; op 2026-08-07 gaf dat 11095 = 11095 tekens,
byte-identiek.
