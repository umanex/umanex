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

# Globaal

## 2026-08-25 — Spacing-, border- en shadow-schaal hebben geen token-bron · [refactor]
- **Wat:** De Figma-collection `Base` draagt `spacing-*` (13 stappen), `border-1/2`, `icon-stroke` en de effect styles `shadow/sm|md`. Geen daarvan komt uit `tokens.json`: hun bron is de Tailwind-default, respectievelijk lucide-react. `roles.mjs` zegt zelf "later spacing, en type". Zolang dat er niet is, is de Figma-kant de enige plek waar deze schaal expliciet staat — en dus een tweede bron naast de tokens.
- **Waarom niet nu:** De Storybook→Figma-export moest de waarden ergens vandaan halen; ze rauw laten zou principe 2 van `code-naar-figma` schenden (nul hardcoded waarden). Een `Spacing`-set in `tokens.json` toevoegen is een gecoördineerde token-restructurering die via Tokens Studio en een Pull hoort te lopen — een eigen taak, niet een bijproduct van deze.
- **Deels gedaan (2026-08-25):** de *meting* staat er, de token-bron nog niet. `figma-sync-check.mjs` heeft sinds vandaag een as `[dekking]` die elke Figma-variabele tegen `packages/tokens/tokens.json` toetst (vergelijker: `scripts/figma-token-coverage.mjs`, gesynct vanuit umanex-os). De twintig namen uit dit item staan daar als `BEKENDE_GATEN` — expliciet en greppable, in plaats van ongemeten. Die lijst werkt twee kanten op: een nieuw gat faalt, en een naam die géén gat meer is faalt óók, dus zodra de `Spacing`-set bestaat dwingt CI het opruimen van de lijst af. Draait in CI via `pnpm --filter @umanex/ui figma:check:selftest`; tegenproef in `figma-sync-selftest.mjs` (13 cases).
- **Eerste zet:** Set `Spacing` (en later `Shadow`) in Tokens Studio aanmaken en pushen. `classifySet` in `packages/tokens/build.mjs` gooit sinds 2026-08-05 op een onbekende set, dus de build wijst zelf de weg (HANDOFF 2026-08-05, resolved). Daarna `packages/ui/scripts/figma-sync-check.mjs` de spacing-as tegen de tokens laten toetsen in plaats van tegen de `n × 4px`-rekenregel.
- **Status:** open

## 2026-08-25 — Sync-guard ziet een Figma-wijziging pas na een verse manifest · [test]
- **Wat:** `figma:check` toetst de code tegen `packages/ui/figma/manifest.json` — een neergeslagen meting van het Figma-bestand, geen live verbinding. Wijzigt iemand iets ín Figma zonder de manifest te verversen, dan blijft CI groen terwijl de twee kanten uit elkaar lopen. De omgekeerde richting (code wijzigt, Figma niet) wordt wél gevangen.
- **Waarom niet nu:** CI heeft geen Figma-toegang. De live-kant vereist een `FIGMA_ACCESS_TOKEN` als repo-secret plus een REST-pad (`figma_get_file_data` of de Figma REST API) — dat is een eigen infra-beslissing met een secret erbij, en die hoort Jeroen te nemen.
- **Eerste zet:** Een `figma:manifest`-script dat de manifest via de REST API regenereert, plus een CI-stap die hem regenereert en `git diff --exit-code` doet — dezelfde vorm als de bestaande guard "gegenereerde tokens zijn in sync met tokens.json". Alternatief zonder secret: een pre-commit-waarschuwing wanneer `components/ui/*.stories.tsx` wijzigt zonder dat de manifest meebeweegt.
- **Status:** open

## 2026-08-25 — Hover- en focus-states staan niet in Figma · [ux]
- **Wat:** De Figma-componenten dragen `disabled` als variant, maar geen hover of focus. In de code zijn dat `hover:bg-primary/90`-achtige alpha-mixen en `focus-visible:ring-*`-utilities.
- **Waarom niet nu:** Die kleuren hebben geen token — `primary/90` is een Tailwind-alpha op een rol, geen eigen rol. Ze in Figma zetten betekent een handgemengde kleur, dus een hardcoded waarde, en dat ondergraaft precies de sync-claim die deze export maakt. Bewuste keuze, vastgelegd in de briefing.
- **Eerste zet:** Beslissen of de interactie-states eigen rollen verdienen (`primary-hover`, `ring-offset`) in beide mode-sets. Zo ja, dan volgen de Figma-varianten vanzelf en kan de guard ze meenemen.
- **Status:** open

## 2026-08-24 — umanex-profile voert nog "Design Team Of One" · [docs]
- **Wat:** `.umanex-os/profiles/umanex.md` beschrijft de positionering als *"Design Team Of One"* en de AI-aanpak als *"evolutie van DToO"*. De portfoliosite laat die belofte sinds vandaag los: het bureau-plan stelt dat freelancers structureel zijn vanaf de eerste retainer, dus één-persoon-zijn is geen belofte meer maar een tegenspraak. Het profile bijwerken naar de koper-positionering (meer producten dan designers, capaciteit in dagen) sluit de drift.
- **Waarom niet nu:** het profile is de klant-laag die élke sessie in élke app stuurt, ook buiten portfolio. De site herschrijven was gevraagd; het merkprofiel herschrijven niet. Stil meeveranderen zou een positioneringsbeslissing verstoppen in een portfolio-PR.
- **Eerste zet:** in `profiles/umanex.md` de sectie *Positionering* en *Toekomst* naast `apps/portfolio/lib/copy.ts` leggen en beslissen of DToO helemaal weg moet of blijft staan als historiek. `apps/portfolio/briefings/2026-08-24-feature-bureau-positionering.tcebc.md` heeft de argumentatie.
- **Beslist:** DToO gaat weg als positionering en blijft als één historiek-alinea staan — oudere audits en briefings dragen de term nog, en zonder die noot kan een volgende sessie een vervallen lijn niet van een huidige onderscheiden. De doelgroep is meteen mee vernauwd en de drie naamregels uit het marktonderzoek staan nu in het profiel in plaats van alleen in de portfolio-briefing.
- **Status:** gebouwd — PR #302

## 2026-08-27 — badge.tsx draagt focus-klassen op een element dat geen focus kan krijgen · [refactor]
- **Wat:** `packages/ui/components/ui/badge.tsx` heeft `focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2` in zijn cva-basis, maar rendert een `div` zonder `tabIndex`. Die klassen kunnen per constructie nooit afgaan. Bovendien is het `focus:` en niet `focus-visible:` — een derde vorm naast de `focusRing`-constante die de rest van de laag nu gebruikt.
- **Waarom niet nu:** nul zichtbaar effect, dus het is opruimwerk en geen fix. Het meeliften op een PR die over jobradar-toegankelijkheid gaat zou een wijziging aan een gedeeld component verstoppen in een app-PR.
- **Eerste zet:** beslissen of de Badge ooit focusbaar wordt (een filter-chip zou het willen). Zo nee: klassen weg. Zo ja: `focusRing` uit `@umanex/ui/lib/focus` gebruiken, net als `Button`.
- **Status:** open

## 2026-08-27 — De flow-harness van jobradar draait in geen enkele CI-stap · [test]
- **Wat:** `pnpm --filter jobradar flow` meet sinds vandaag ook de kopstructuur en de toetsenbord-/focus-volgorde, met een tegenproef per as. CI draait er niets van: `.github/workflows/ci.yml` roept wél `pnpm --filter cashflow flow:ci` en `pnpm --filter jobradar scenarios` aan, maar geen jobradar-flow. Een regressie in de koppen of in een focus-ring komt dus pas boven wanneer iemand de harness met de hand draait.
- **Waarom niet nu:** een CI-stap toevoegen is een infra-beslissing (extra buildtijd, en de harness bouwt zelf) die niet gevraagd is bij deze taak. De harness bouwen was de opdracht; hem in de pijplijn hangen is de volgende.
- **Eerste zet:** de vorm van cashflow kopiëren — die heeft een `flow:ci` die de build van de type-check-stap hergebruikt (`--dist=.next`) in plaats van opnieuw te bouwen. jobradar heeft die variant nog niet; zonder haar kost de stap een tweede volledige `next build`.
- **Status:** open

# Klant — umanex

## 2026-09-07 — Compacte maat in @umanex/ui · [design-system]
- **Wat:** Een compacte size-as op `Button` en `Input` in `packages/ui` (de cashflow-maatvoering: `h-7`/`h-8`, `text-dense`, `rounded-sm`, `focus:ring-1`), zodat een dichte app de gedeelde primitives kan gebruiken zonder ze per call-site te overschrijven.
- **Waarom niet nu:** Twee redenen. (1) Een variant toevoegen aan een primitive is een design-system-wijziging en die hoort vooraf bevestigd (CLAUDE.md → *Acties die altijd eerst moeten worden bevestigd*). (2) `pnpm --filter @umanex/ui figma:check` faalt hard op een variant-as die code en Figma niet delen — hij staat nu groen op 19 checks. Een nieuwe size vraagt dus ook de component-set in het Figma-bestand **Component library** (`ko2OuasYxyY2YRD69MYhWX`) én een verse `figma/manifest.json`, wat een actieve Desktop Bridge vereist.
- **Meting die dit item opende (2026-09-07):** 96 hand-gerolde primitives in `apps/cashflow` geclassificeerd tegen `@umanex/ui`: **2 schone swaps** (de twee primaire modal-knoppen, allebei gemigreerd), **58 te dicht** voor elke bestaande maat, **36 geen primitive** (drag-handles, glyph-affordances, klikbare rijen). De 58 kosten elk vier tot zes overschrijvende klassen; dat levert een primitive op die tegen zijn eigen defaults vecht.
- **Eerste zet:** beslissen of de compacte schaal in de primitive hoort of in een cashflow-lokale wrapper (`DenseInput` bovenop `Input` — geen design-system-wijziging, geen Figma-herbouw, en de `[dubbel]`-as van `ds:guard` vlagt hem niet omdat de naam geen export dubbelt). Pas daarna bouwen.
- **Status:** open

## 2026-09-07 — Design-systeem-bron als pre-commit-signaal · [infra]
- **Wat:** `.githooks/pre-commit` laten waarschuwen bij een aangeraakte app zonder `## Design-systeem-bron`-sectie, naast de bestaande waarschuwing voor `## Verify-pad`. CI faalt er al hard op (`pnpm ds:guard`), maar dat signaal komt pas ná de push; de hook geeft het bij de commit.
- **Waarom niet nu:** De hook heeft zijn canonieke bron in `umanex-os/templates/githooks-pre-commit` en wordt door `scripts/sync-os.sh` onvoorwaardelijk overgekopieerd (`cp "$GITHOOK" .githooks/pre-commit`, regel 498). Een edit die alleen hier staat is dus stil verlies bij de eerstvolgende sync. En in `/Users/jeroen/Documents/umanex-os` stond bij het schrijven van dit item onvastgelegd werk van Jeroen op `main` (`strategie/README.md`, `strategie/aanbod-catalogus.html`, `strategie/prijslijst.html`) — daar een taak naast beginnen is precies wat CLAUDE.md → Git workflow verbiedt.
- **Eerste zet:** in umanex-os een branch vanaf `origin/main`, de waarschuwing in `templates/githooks-pre-commit` naast blok 6 zetten (zelfde vorm: waarschuwen, niet blokkeren, alleen voor apps die in déze commit veranderen), en `scripts/sync-os.sh` in umanex-apps draaien. Tegenproef: een commit die `apps/<app>/` raakt in een repo waar die app géén sectie heeft moet de regel tonen, en mét sectie zwijgen.
- **Status:** open

## 2026-08-25 — Storybook-build in CI en turbo · [infra]
- **Wat:** `build-storybook` van `@umanex/ui` als turbo-task opnemen en in `ci.yml` draaien, zodat een story of docs-blok dat niet meer compileert de PR rood maakt in plaats van pas bij de volgende `pnpm storybook`.
- **Waarom niet nu:** `turbo.json` en `ci.yml` zijn config-bestanden die vooraf bevestigd horen te worden; de Storybook-opzet zelf (PR `chore/storybook-ui`) is gebouwd zonder die stap.
- **Eerste zet:** `"build-storybook": { "dependsOn": ["^build"], "outputs": ["storybook-static/**"] }` in `turbo.json`, en `pnpm turbo build-storybook` naast de bestaande build-stap in CI. Optioneel: Chromatic of een statische deploy voor review.
- **Status:** gebouwd — 2026-08-25, PR `chore/storybook-ci`; tegenproef: een story met een niet-bestaande import laat `pnpm turbo build-storybook` falen (exit ≠ 0).

## 2026-08-25 — CLAUDE.md-sectie "Eén app, één worktree" spreekt de globale laag tegen · [docs]
- **Wat:** De sectie *Parallel aan twee apps werken* in `CLAUDE.md` schrijft nog `git worktree add ../umanex-apps-<app>` voor, terwijl `.umanex-os/CLAUDE.md` (sinds 2026-08-25) de zusmap-conventie schrapt en app-werk in de hoofdtree op een feature branch zet. Sectie herschrijven of vervangen door een verwijzing naar de globale regel.
- **Waarom niet nu:** Buiten de scope van de Storybook-taak; het is een repo-conventie die Jeroen zelf hoort te bekrachtigen.
- **Eerste zet:** `grep -n "worktree" CLAUDE.md` en de sectie vervangen door: hoofdtree, feature branch vanaf `origin/main`, stage per pad; de poort-tabel (cashflow :3000, PM2) blijft relevant.
- **Status:** gebouwd — 2026-08-25, PR #306 (`docs/parallel-werk-hoofdtree`); de PR bestond al vóór deze entry geschreven werd. Tegenproef: `grep -n 'umanex-apps-' CLAUDE.md apps/*/CLAUDE.md` levert alleen nog de regel op die de zusmap expliciet afschaft (`.umanex-os/` en dit bestand vallen buiten het meetbereik — die dragen de string als voorbeeld). Onderweg gemeten: de cashflow flow-harness deelt `.next` met PM2, zie `apps/cashflow/BACKLOG.md`.

## 2026-09-07 — CI Node-20-deprecation zit in de actions, niet in node-version · [infra]

- **Wat:** `actions/cache`, `actions/setup-node` en `pnpm/action-setup` in `.github/workflows/ci.yml` en `.github/workflows/tokens-sync.yml` naar de majors bumpen die op Node 24 draaien, en tokens-sync.yml `node-version` 20→22 gelijktrekken met ci.yml — of de niet-blokkerende annotatie expliciet als geaccepteerd noteren.
- **Waarom niet nu:** HANDOFF-item van 2026-07-15, ouder dan 30 dagen bij de triage van 2026-09-07 (sessie-reflectie stap 1): werk dat blijft liggen, geen sessie-context. Triage-bewijs: Check gedraaid: `grep -n 'actions/cache@\|actions/setup-node@\|pnpm/action-setup@' .github/workflows/*.yml` → ci.yml:19 `pnpm/action-setup@v4`, :25 `actions/setup-node@v4`, :34 en :135 `actions/cache@v4`; tokens-sync.yml:49/55/64 dezelfde drie op @v4…
- **Eerste zet:** `for r in actions/setup-node actions/cache pnpm/action-setup; do gh api repos/$r/releases/latest --jq .tag_name; done` om te zien of er Node-24-majors zijn, en `gh run view $(gh run list -w ci.yml -L1 --json databaseId -q '.[0].databaseId')` om te lezen of de 'forced to run on Node.js 24'-annotatie nog verschijnt; dan de @v4-regels (ci.yml:19/25/34/135, tokens-sync.yml:49/55/64) bumpen in één `ci:`-commit.
- **Check:** `grep -n 'actions/cache@\|actions/setup-node@\|pnpm/action-setup@' .github/workflows/ci.yml` → nog @v4 = de annotatie blijft komen.
- **Status:** open
