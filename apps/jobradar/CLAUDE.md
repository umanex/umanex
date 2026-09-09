# jobradar — projectcontext

Vacature- en lead-tracker voor UX/UI-freelancers. Next.js 14 (App Router), dev op poort 3003.

Dit bestand is bewust **minimaal**: het bevat alleen wat gemeten is. Vul de rest aan wanneer er
echt aan deze app gewerkt wordt — verzonnen projectcontext is schadelijker dan geen.

## Bronnen en bereik

| | |
|---|---|
| **Vacatures** | Adzuna (`lib/sources/adzuna.ts`). Zoektermen en ophaal-grenzen in `lib/config/profile.ts`. |
| **Zoekopdracht** | Gemeten, niet gekozen (2026-08-11). `what_or` matcht losse woorden en Adzuna rekt ze op: `product` matchte óók "productie" en bracht magazijn-, winkel- en chauffeurswerk binnen — 743 van de 1222 treffers. Eruit; "Product Designer" komt binnen via `designer`. Resultaat: 665 → 326 opgehaalde vacatures, **dezelfde 51 geclassificeerd**, 24 → 25 leads, en WVL en OVL vallen nu onder het plafond. De uitsluitlijst is bewust smal — een bredere haalde 1 procentpunt ruis weg en kostte Smals als lead. |
| **Leads** | Afgeleid uit de vacaturedata (`lib/signals.ts`, bron `vacatures`). |
| **Koppeling** | Van bedrijfsnaam naar ondernemingsnummer via `lib/kbo/koppeling.ts` en de tabel `naam_index` in de spiegel (2,0 miljoen benamingen van actieve ondernemingen, herbouw ~10 s). De regel is streng: exact één actieve kandidaat, anders niets; regio breekt hoogstens een gelijkspel. Gemeten over de 27 leads: **12 gekoppeld, 0 dubbelzinnig, 15 niet gevonden** — en één van die twaalf ("Smile Group") wijst naar een tandartspraktijk. Uniek is niet juist. Daarom toont de leadkaart de koppeling als *vermoeden* met naam, gemeente en hoofdactiviteit ernaast, en overschrijft ze niets. Koppelen gebeurt bij het renderen (0,1 ms per opzoeking), niet bij de sync — wat niet opgeslagen wordt, kan niet verouderen. |
| **Prospects** | Eigen tabblad sinds 2026-08-29, gevoed door de KBO-spiegel via `/api/prospects` — **niet** via `LEAD_SOURCES`. Bewust gescheiden: een lead is een bewering mét bewijs uit de vacaturedata, een prospect is "het juiste soort bedrijf" zonder gebeurtenis. Op één score-as landen 14.613 nullen naast 27 echte leads. De selectie staat als één verklaring in `lib/kbo/universum.ts`: NACE 2025 `62100/62200/62900/58290/63910/58210`, hoofdactiviteit, actief, zetel in WVL/OVL/BRU. Standaard staat de RSZ-zeef aan (activiteitengroep `006` bestaat alleen bij werkgevers): 2.903 van de 14.613. Statussen leven in `jobradar.db` (`prospect_status`), nooit in de wegwerpbare spiegel. |
| **KBO/BCE** | SFTP-drop van FOD Economie (`ftps.economie.fgov.be`, map `opendata`). Gemeten 2026-08-29: **dagelijks** een `_Full.zip` (~298 MB) én een `_Update.zip` (0,4–5,6 MB), retentie **32 dagen**. De Update draagt per tabel een `_delete.csv` (alleen de sleutel) en een `_insert.csv`. `pnpm --filter jobradar kbo:sync` spiegelt dat naar `.data/kbo.db`. Let op de naam: de host heet *ftps* maar poort 21 is FTP **zonder** TLS (geen `AUTH TLS` in `FEAT`); het versleutelde kanaal is SSH op 22. En de drop biedt de methode `password` niet aan — inloggen gaat via `keyboard-interactive`, wat `sftp -b` (BatchMode) stil onmogelijk maakt. |
| **KBO-staat** | Komt uit `meta.csv` in de zip, niet uit de bestandsnaam. Die twee lopen bewust uiteen: het bestand van 29-08 draagt `SnapshotDate` 28-08. Het script vergelijkt beide en stopt bij tegenspraak. Een gat in de reeks extractnummers is een harde stop — updates gelden alleen op precies de vorige staat, en "de rest maar toepassen" levert een database die compleet lijkt en het niet is. |
| **Twee assen** | De **vacaturescore** (`SCORE_SKILLS`) zegt hoe interessant werk is om zélf te doen; de **classificatie** (`DESIGN_SKILLS`/`DEV_SKILLS` + de rolwoorden) zegt of het bedrijf een lead is. Backend staat bewust alleen in de tweede (beslissing 2026-08-10): een .NET-vacature scoort 0, maar het .NET-huis zonder designer is wél een lead. Laat die assen niet samenvallen — dat is precies de faalklasse in `LEARNINGS.md`. |
| **Regio's** | WVL · OVL · BRU, en **dat blijft zo** (beslissing 2026-08-10). De zoekstraal rond de ankers loopt over de provinciegrens, dus Adzuna levert ook Vlaams-Brabant; die vacatures vallen weg en de bron meldt hoeveel. Bewuste keuze, geen gat. |
| **Adzuna-limiet** | Adzuna stuurt **geen** limiet-headers mee — geen `X-RateLimit-Remaining`, geen `Retry-After` — dus een 429 is het enige signaal dat je te snel vraagt. De bron haalt regio's daarom serieel op, pauzeert tussen verzoeken en probeert een 429 twee keer opnieuw (`ADZUNA_SEARCH.pauzeMs` / `retriesBij429`). Een sync duurt daardoor ~12s in plaats van een paar seconden; dat is de prijs van volledige data. Een test op `/instellingen` kost 3 verzoeken, een sync er 9 tot 15. |
| **Pagineringsplafond** | 5 pagina's × 50 per regio (beslissing 2026-08-10). Brussel heeft er meer dan 600, dus dit kápt af — de bron zet dat als waarschuwing in `sourceStatuses`. Ook bewust. |

## Design-systeem-bron

Welke laag deze app zijn vorm van krijgt. Gemeten, niet afgeleid: `scripts/design-system-guard.mjs`
toetst elke regel hieronder tegen wat er op schijf staat. "geen" is overal een geldig antwoord,
mits het er staat.

- **Preset:** `@umanex/config/tailwind/preset`
- **Componentbron:** `@umanex/ui`
- **Storybook:** `pnpm --filter @umanex/ui storybook` (:6006)

Een nieuwe primitive hoort in `packages/ui` met een story ernaast, niet in deze app.

---

## Verify-pad

Wat de `verify`-skill hier kan uitvoeren. Vastgesteld 2026-08-08 en bijgewerkt 2026-08-10, telkens
door het te draaien, niet door het af te leiden. Staat er "geen", dan is dat een gat dat gebouwd
moet worden — geen vergetelheid.

| Capability | Commando / status |
|---|---|
| **Render vastleggen** | `pnpm --filter jobradar flow --shot=.flow-shots` — legt per route een full-page PNG vast op de verse build. Gemeten: `index.png`, 27 KB. `.flow-shots/` is gitignored: het is bewijs van één run, geen artefact om te bewaren. |
| **Flow aandrijven** | `pnpm --filter jobradar flow` — Playwright op een verse build. Laadt elke route (`/` en `/instellingen`), drijft één echte interactie aan (het **status**-filter: `"" → "new"` — de harness pakt `select:visible` en het regio-filter bestaat uit checkboxes), en telt console-fouten. De interactie doet vooraf een expliciete `goto` naar `/`: zonder die regel verhuist hij mee naar de láátste route en valt hij stil terug op een linkklik. `--headed` om mee te kijken. |
| **Toegankelijkheid meten** | Zit ín de harness, per route. **Kopstructuur:** leest alle `h1`–`h6` in documentvolgorde en faalt op een overgeslagen niveau (gemeten 2026-08-27: `/` heeft 336 koppen, h1 → h2 → h3). **Toetsenbord:** loopt de echte tab-volgorde af (max 80 stops) en toetst per stop **differentieel** of de computed `outline`/`box-shadow` bij focus verandert — dus niet of er een klasse staat, maar of er iets te zien is. De volgorde zelf komt als `note` in de uitvoer, plus een melding bij een positieve `tabindex`. Dit is het gat dat de ux-audit van 2026-08-11 niet kon meten: zijn browserautomatisering kreeg geen `Tab` in de pagina. |
| **State forceren** | **Gedeeltelijk.** De harness meet wat er in `.data/jobradar.db` van díe tree staat: in een verse worktree is dat de lege staat (*"Geen vacatures gevonden"*), in een tree waar ooit gesynchroniseerd is de gevulde. Loading en error zijn **niet** op te wekken — er is geen fixture-laag en geen mock-route. Wie die states wil toetsen, bouwt eerst een onderschepte route zoals `apps/cashflow/scripts/flow-harness.mjs` die heeft. |
| **Invariant draaien** | `pnpm --filter jobradar scenarios` — 693 invarianten over vier suites (gemeten 2026-08-27; de tabel zei 634, dat was een oudere telling): de scorekern en signaal-afleiding (`signal-scenarios.ts`), de sync-upserts tegen een `:memory:`-database met het echte schema (`upsert-scenarios.ts`), de Adzuna-ophaallaag met een gestubde `fetch` (`adzuna-scenarios.ts`), en de configuratielaag zelf (`config-scenarios.ts` — de gehardende faalklasse uit `LEARNINGS.md`: geen rolwoorden in de vaardighedenlijst, elk keyword vindt zichzelf, de omschrijving beslist nooit de rol, en de twee assen staan vastgepind). Elke suite draait zijn tegenproef ervóór — `SCENARIO_SELFTEST=1` injecteert één check die móét falen, en die run hoort niet-nul te eindigen. Geen netwerk, geen database op schijf, geen transpiler: Node 24 stript de types zelf en `scripts/ts-resolve.mjs` lost de extensieloze relatieve imports op. |
| **Sync tegen de echte bron** | Kan, maar **nooit tegen `.data/jobradar.db`** — dat is de database die je zelf gebruikt. Bouw, start op een vrije poort met een wegwerp-pad, en synchroniseer daartegen: `JOBRADAR_DB_PATH=/tmp/wegwerp.db node_modules/.bin/next start --port 3113`, dan `curl -X POST 127.0.0.1:3113/api/sync`.<br><br>**Twee keer draaien is géén idempotentie-bewijs.** Adzuna geeft niet elke aanroep dezelfde set: op 2026-08-10 gaf run 1 een `HTTP 429` op pagina 3 van WVL, waarna run 2 de ontbrekende 136 vacatures alsnog toevoegde. `jobsAdded > 0` op de tweede run kan dus de bron zijn, niet je code — lees eerst de waarschuwingen in `sourceStatuses`. Wat je op live data wél hard kunt toetsen is dat er geen duplicaten ontstaan (`COUNT(*) == COUNT(DISTINCT source, external_id) == COUNT(DISTINCT dedupe_hash)`). Idempotentie zelf wordt deterministisch bewezen in `upsert-scenarios.ts`. |
| **Prospects-tabblad** | Zit ín de flow-harness: die klikt het tabblad aan, wacht op `/api/prospects`, telt de kaarten in de DOM (grens 60) en draait daarna de kopstructuur- en toetsenbord-passes op het verse paneel. Zonder spiegel toetst hij dat de lege staat uitlegt wat er moet gebeuren in plaats van stil nul te tonen. De drie lege toestanden zijn los te forceren met `KBO_DB_PATH` naar een niet-bestaand pad, of naar een mini-spiegel met alleen `kbo_meta`. |
| **KBO-spiegel** | `pnpm --filter jobradar kbo:sync --status` toont de lokale staat en rijaantallen zonder netwerk; `--ls` toont wat er op de drop staat; `--full` bootstrapt of herstelt; zonder vlag past hij de openstaande updates toe. Draait **niet** in CI: het vraagt credentials en honderden MB's. Wat CI wél bewaakt is de leeslaag — `scripts/kbo-scenarios.ts` toetst de CSV-grammatica, de chunkgrenzen en de datumconversie. |
| **Request/response aandrijven** | `pnpm --filter jobradar opvolging:probe <werkmap>` — bouwt in `.next-apiprobe`, start op **3117** tegen een verse database in de meegegeven map, en rijdt de opvolging-routes af: contactmoment op een lead en op een prospect, de statusovergang, de opt-out-rem (409), een datum in de toekomst (400), een onbekend kanaal (400), een onbekend bedrijf (404), één volgende actie die de vorige vervangt, en het verwijderen van een moment. Raakt `.next` niet en raakt `.data/jobradar.db` niet. Dit was tot 2026-09-09 een gat: er bestond geen instrument dat een route echt aanriep. |
| **Verse build** | Zit ín de harness: die draait altijd eerst `next build` en start `next start` op **3103**, en weigert te draaien als daar al iets luistert. Je test dus per definitie de huidige code, nooit een oude bundel. Een dev-server op 3003 wordt met rust gelaten. |

**Waarom de harness geen knoppen aanklikt.** Het dashboard heeft een knop *"Sync nu"* die externe
bronnen ophaalt. Elke aanvraag buiten de eigen origin wordt door de harness afgebroken en geteld
als lek — één lek en de run faalt. Dat is de bedoeling (zo kan hij per constructie geen echte data
raken), maar het betekent ook dat een blinde klik op die knop een *valse* bevinding zou opleveren.
De harness bedient daarom `select`-elementen en interne links, nooit willekeurige knoppen.

**De harness kan falen, en dat is getoetst.** `pnpm --filter jobradar flow --selftest` spuit per as
een defect in dat hóórt te worden gevangen: een onbereikbare route, een `h5` na de kaart-`h3`'s, en
een knop met `outline`/`box-shadow` op `none !important`. Let op de omkering: die run eindigt op
**exit 0** wanneer álle drie de assen inderdaad faalden — de zelftest slaagt dán. Blijft er één
groen, dan meet díe as niets en is exit 1 het juiste antwoord. Zonder die kant weet je niet of groen
"alles goed" betekent of "ik kijk nergens naar".

Dat is geen theorie: de eerste versie van de toetsenbord-zelftest hing de kapotte knop achteráán de
body en bleef stil groen — het dashboard heeft honderden tab-stops, dus de knop viel buiten het
bereik van de pass. Hij staat nu vooraan (`prepend`) en is daarmee op elke pagina de eerste stop.

## Meten in dark mode

De `Badge` draagt `transition-colors` (150 ms). Wie direct na een mode-wissel
(`documentElement.classList.add('dark')`) `getComputedStyle` leest, krijgt de **oude** kleur terug —
de transitie loopt nog. Gemeten op 2026-08-27: de score-pil rapporteerde in dark een light-kleur,
terwijl de scheiding in de dekkingsindicator (zonder transition) wél meteen omsloeg. Die twee
signalen die elkaar tegenspraken waren het alarm, niet de bevinding — er was geen CSS-fout, alleen
een meting die te vroeg kwam. Wacht ~400 ms na de wissel, of meet met `transition: none`.

Dark mode heeft in jobradar overigens **geen schakelaar in de UI** — `.dark` bestaat in
`app/globals.css` en in de rollaag, maar niets zet de class. Een dark-meting is dus altijd een
geforceerde meting.
