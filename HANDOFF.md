# HANDOFF.md — sessie-handoff (vooruitkijkend)

Dit bestand is de **vooruitkijkende tegenhanger** van `LEARNINGS.md`. Waar LEARNINGS de rauwe vangst van *fouten* is, houdt HANDOFF de open **onzekerheden, aannames, risico's, next steps en ideeën** bij die een sessie achterlaat — zodat een volgende sessie niet koud begint.

Entries komen erbij via de `sessie-reflectie` skill aan het einde van een sessie. De open items worden bij de start van een volgende sessie automatisch getoond via de user-level SessionStart-hook (`~/.claude/hooks/session-start-handoff.sh`). Niet handmatig bewerken tenzij je een status corrigeert.

## Waarom dit bestaat

Aan het einde van een sessie zit de meeste context in het hoofd van Claude en verdampt bij afsluiten: waar was ik het minst zeker over, welke aanname bleef onuitgesproken, wat breekt over 3 maanden, wat is de eerste zet volgende keer. HANDOFF vangt dat expliciet op zodat het meekomt.

Dit is **geen duplicaat van de eval-loop**. Een terugkerende *faalklasse* hoort in `LEARNINGS.md` (via `vastleggen`); een *durend feit* hoort in auto-memory. HANDOFF is enkel voor het vooruitkijkende, sessie-gebonden restant.

## Statussen

- `open` — vastgelegd bij reflectie, nog niet opgepakt. Wordt bij sessiestart getoond.
- `resolved` — opgepakt of beantwoord in een latere sessie; blijft staan als spoor, wordt niet meer getoond.

## Types

`onzekerheid` · `aanname` · `risico` · `next-step` · `idee` · `debt`

## Format

Elke entry staat onder een laag-header (`# Globaal`, `# Klant — {naam}`, `# Project — {app}`) en heeft deze vorm:

    ## YYYY-MM-DD — {korte titel} · [{type}]
    - **Bevinding:** {1-2 zinnen}
    - **Check:** {hoe je in één handeling vaststelt of dit nog openstaat}
    - **Volgende zet:** {concreet actiepunt of "-"}
    - **Status:** open

## Schrijf de check, niet de staat

`Bevinding` is per definitie een waarneming van toen: "de guard matcht alleen Tailwind-syntax", "CLAUDE.md is 32 123 chars". Zulke zinnen worden onwaar zodra de code eronder verandert, en niets in de lus merkt dat — de SessionStart-hook blijft het item elke ochtend tonen als openstaand werk, ook nadat het opgelost is. Op 2026-08-10 stond tien van de zesendertig rowtrack-entries zo verkeerd open; één ervan lokte vijf dagen na zijn oplossing alsnog een productvraag uit die al beantwoord was.

Daarom hoort er bij elke nieuwe entry een **`Check`**: hoe je in één handeling vaststelt of dit item nog leeft. Een commando is het beste (`grep -q 'periodType' apps/rowtrack/lib/period.ts`), een vraag met een eenduidig antwoord mag ook ("draaien `history/index.tsx` en `usePeriodGoal` door dezelfde `lib/period.ts`?"). Kun je er geen formuleren, dan is het item te vaag om over drie weken nog te beoordelen — herformuleer het tot je er wel een hebt.

De check wordt bij sessiestart mee getoond, en `sessie-reflectie` draait hem bij stap 1 vóór een item open blijft staan. Een check die door niets aangeroepen wordt, meet niets.

<!-- De sessie-reflectie skill voegt hieronder de juiste laag-header toe bij de eerste entry. -->
# Klant — umanex

## 2026-08-25 — "100% in sync" is structureel bewezen, niet visueel · [onzekerheid]
- **Bevinding:** De Storybook→Figma-export is op vijf assen getoetst (pagina per component, variant-assen, kleurrollen, afgeleide schalen, deep-links) plus 86 mode-waarden tegen `theme.css`. Wat níet getoetst is: of een component in Figma er hetzelfde *uitziet* als in de browser. Beide kanten putten uit dezelfde bron, maar de twee renders zijn nooit naast elkaar gelegd. Een Button met 2px verkeerde padding in Figma zou door elke groene check komen. De claim in de PR is dus enger dan "100% in sync" suggereert — dat is bewust, maar het staat nergens in de guard-output zelf.
- **Check:** `pnpm --filter @umanex/ui figma:check | grep -i "pixel\|render\|screenshot"` — leeg = er is nog geen visuele as; een treffer = er is er een bijgekomen.
- **Volgende zet:** Beslissen of dit gat gedicht moet worden. Kandidaat: `figma_capture_screenshot` van een component-node naast een Playwright-screenshot van dezelfde story, vergeleken op afmetingen in plaats van pixels (byte-exacte PNG-hashes zijn in Chromium geen identiteitstoets — zie umanex-os LEARNINGS 2026-08-25). Of expliciet verwerpen en de scope in `packages/ui/CLAUDE.md` benoemen.
- **Beantwoord (2026-09-08):** **ja, dichten** — en de voorgestelde kandidaat is precies wat werkt. Op RowTrack zijn beide lagen gebouwd en gemeten: `geometry-parity.mjs` (109 variant-nodes, 1066 velden, tolerantie 0,5px, mét een tegenproef die rood wordt op één verschoven hoogte) plus een handmatige beeldronde. Die beeldronde verdiende zichzelf meteen terug: hij vond dat `text-transform: uppercase` niet in de DOM-tekst zit, dus Figma toonde "500m" waar de browser "500M" rendert — 42 nodes in 12 componenten, en de geometrie-as kán dat per constructie niet zien. De vraag is dus beantwoord; het restwerk (dezelfde beeldronde op `packages/ui` draaien) staat in `BACKLOG.md` (entry 2026-09-08).
- **Status:** resolved

## 2026-08-25 — Figma node-ids zijn de zwakste schakel van de deep-links · [risico]
- **Bevinding:** De elf `parameters.figma.url` in de stories wijzen op node-ids (`27:374` enz.). Die ids overleven hernoemen, verplaatsen en herlayouten — dat is deze sessie gemeten — maar niet delete-en-opnieuw-aanmaken. Wie een component in Figma herbouwt in plaats van bijwerkt, breekt elf links tegelijk, en de guard zwijgt tot iemand de manifest ververst (dat gat staat apart in `BACKLOG.md`). De builder in `code-naar-figma` doet zélf `for (const c of [...page.children]) c.remove()` vóór hij bouwt — dus een herbouw ís het normale pad, niet de uitzondering.
- **Check:** `node -e "const m=require('./packages/ui/figma/manifest.json'); console.log(m.pages.Button.primary.id)"` vergelijken met wat `figma_execute` teruggeeft voor de node met naam `Button` op pagina `Button` — gelijk = de ids leven nog.
- **Volgende zet:** Bij de eerstvolgende Figma-herbouw eerst de manifest verversen en `figma:check` draaien vóór de commit; overwegen om de link op **pagina**-id te laten wijzen in plaats van node-id (stabieler, minder precies) of de node-id-check in `pre-commit` te hangen.
- **Bewezen (2026-09-08), en erger dan hier staat:** het risico is op RowTrack werkelijkheid geworden en de guard zweeg niet alleen — hij stond **groen**. Na een herbouw waren 29 van de 33 primary-ids veranderd en wezen alle 33 deep-links naar niet-bestaande nodes, terwijl `figma:check` tien assen groen meldde. De reden is structureel: de `[link]`-as legt de stories naast het manifest, en de stories wáren uit dat manifest gegenereerd — twee artefacten uit dezelfde verouderde bron bevestigen elkaar. Voor RowTrack is de volgorde nu een harde regel in `apps/rowtrack/CLAUDE.md` (eerst manifest verversen, dan links en check); `packages/ui` heeft die regel nog niet. Vastgelegd als learning in umanex-os (2026-09-08, "code-naar-figma — een guard op twee artefacten uit dezelfde verouderde bron").
- **Volgende zet (2026-09-08):** de procedure is te zwak als enige bescherming. Overweeg een verse-heid-as in `figma:check`: faal wanneer `manifest.gegenereerd` ouder is dan de nieuwste wijziging aan de stories of de bouwspec. Dat is een proxy, maar hij kan wél rood worden zonder Figma-toegang.
- **Status:** open

## 2026-08-25 — De variant-modellering is een oordeel dat de guard nu als waarheid vastlegt · [aanname]
- **Bevinding:** Welke props een visuele Figma-variant verdienen is niet uit de code af te leiden — `cva` levert er een deel van, `argTypes` een deel, en de rest is een keuze. `Input.type` en `Tooltip.side` zijn uitgesloten, `ThemeToggle.mode` is Figma-only (interne state). Die drie staan mét reden in `figma-sync-check.mjs`, dus ze zijn telbaar — maar ze zijn wél mijn oordeel, niet dat van Jeroen, en de guard dwingt ze vanaf nu af.
- **Check:** `grep -A3 "NIET_VISUEEL\|FIGMA_ONLY" packages/ui/scripts/figma-sync-check.mjs` — de lijst is kort en leesbaar; klopt elke regel nog met wat je van het component verwacht?
- **Volgende zet:** Bij de eerstvolgende component-wijziging de drie uitsluitingen doorlopen en bevestigen of bijstellen. Ze staan bewust in de guard en niet in een config-bestand, zodat ze bij het lezen van de guard vanzelf langskomen.
- **Uitgebreid (2026-09-08):** het zijn nu twee lijsten, in twee repos-onderdelen, allebei mijn oordeel. `apps/rowtrack/scripts/figma-sync-check.mjs` heeft er drie soorten: `NIET_VISUEEL` (vier keer `visible` — een mount-schakelaar; bij false rendert het component niets, gemeten), `SCHERMEN` (ActivePhase en IdlePhase zijn schermcomposities, geen component sets — hun statusassen zouden 160 respectievelijk 320 nodes eisen en zijn in beeld niet orthogonaal) en `GEEN_COMPONENT` (PaceZone exporteert een pure functie zonder JSX). Jeroen heeft de schermen-keuze expliciet bevestigd; de andere twee niet. Dezelfde vraag geldt dus nu op twee plekken.
- **Status:** open

## 2026-08-10 — De laag-discipline-guard ziet kale hex in CSS niet · [debt]
- **Bevinding:** De regel `hardcoded-color` in `packages/tokens/scripts/guard.mjs` matcht alleen Tailwinds arbitrary-syntax (`bg-[#fff]`), niet een gewone `color: #ff0000` in een `.css`-bestand of een `fill="#..."` in een SVG — terwijl de docstring van diezelfde guard juist zegt dat hij bestaat omdat ESLint die twee niet ziet. Ontdekt doordat een tegenproef níet afging waar ik hem verwachtte.
- **Volgende zet:** Het gat is klein en gemeten: kale hex komt in álle guard-scopes samen **één keer** voor, in `apps/cashflow/scripts/render-charts.tsx:149` (inline `<style>` in een preview-script). Een zevende regel toevoegen kost dus één baseline-entry of één refactor. Niet zelf gedaan: het verbreedt een guard die vier apps raakt.
- **Check:** `grep -c "id: '" packages/tokens/scripts/guard.mjs` — 7 = status quo (zes regels + font-token-drift), de kale-hex-regel is er nog niet; 8+ = er is een regel bij, toets of die kale hex in CSS/SVG dekt.
- **Status:** resolved (2026-09-09) — check gedraaid: `grep -c "id: '" packages/tokens/scripts/guard.mjs` → 7, de status quo, dus de regel ontbreekt nog. Werk dat blijft liggen: verplaatst naar de root-`BACKLOG.md` (2026-09-09); ouder dan 30 dagen.

## 2026-08-10 — hexToHslTriplet staat nu in twee pakketten · [debt]
- **Bevinding:** `packages/rowtrack-tokens/lib/hslTriplet.mjs` is een bewuste kopie van `packages/tokens/lib/hslTriplet.mjs`. De afweging: de twee token-pipelines zijn onafhankelijk ontworpen, en een import ertussen creëert een koppeling waar er geen hoort — voor een pure functie van vijftig regels. Prijs: verandert de afrondingsstrategie, dan moet dat op twee plekken.
- **Volgende zet:** Niets, tenzij er een derde consument komt. Dan is een gedeeld `packages/color-utils` goedkoper dan een derde kopie.
- **Check:** `grep -rln hexToHslTriplet packages/ apps/ | wc -l` — 4 = status quo (twee kopieën + hun twee builds); 5+ = er is een derde consument en het gedeelde pakket wordt goedkoper dan een derde kopie.
- **Status:** resolved (2026-09-09) — check gedraaid: 4 bestanden noemen hem, de status quo — nog geen derde consument, dus de afweging is ongewijzigd. Verplaatst naar de root-`BACKLOG.md` (2026-09-09); ouder dan 30 dagen.

## 2026-08-04 — React 18 en 19 delen één platte node_modules · [risico]
- **Verplaatst:** dit punt hoort bij RowTrack, want die app dwingt de platte layout af. De volledige bevinding — inclusief de mislukte poging met de geïsoleerde layout (alle Next-builds groen, Metro valt op de phantom dependency `@expo/metro-runtime`) en de drie uitwegen — staat in `apps/rowtrack/HANDOFF.md`, entry van dezelfde datum. Hieronder de oorspronkelijke, inmiddels achterhaalde formulering.
- **Bevinding:** De root `.npmrc` zet `node-linker=hoisted` en `shamefully-hoist=true`, dus
  de hele workspace deelt één platte `node_modules` met één `react`. Rowtrack pint
  `react@19.1.0` (Expo 54), de vier Next 14-apps en `packages/ui` willen `^18`. React 19
  wint aan de root; `react-dom` blijft op 18.3.1 omdat rowtrack die niet gebruikt. Het
  postinstall-script in de root `package.json` symlinkt daarom elke app-`react` naar
  `next/node_modules/react`. Die constructie breekt zodra een nieuwe dependency met een
  React-peer de resolutie verschuift: `pnpm add recharts` liet `next/node_modules/react`
  verdwijnen, waarna elke Next-build viel met `ReactCurrentDispatcher of undefined`.
- **Volgende zet:** `node-linker=hoisted` verplaatsen van de workspace-root naar
  `apps/rowtrack/.npmrc` (waar hij al staat), zodat de Next-apps pnpm's geïsoleerde layout
  krijgen en elk hun eigen react 18 + react-dom 18 resolven. Daarna kan het
  symlink-postinstall weg. Let op: pnpm behandelt `node-linker` als workspace-brede
  instelling, dus een per-package `.npmrc` wordt mogelijk genegeerd — lukt dat niet, dan is
  rowtrack uit de pnpm-workspace halen (eigen lockfile) het gangbare alternatief voor een
  React Native-app in een gemengde monorepo. Verifieer met een schone install plus een
  build van alle vier de Next-apps én een Metro-start van rowtrack.
- **Status:** resolved — verplaatst naar `apps/rowtrack/HANDOFF.md` (2026-08-04)

## 2026-08-05 — Tokens Studio push-round-trip is nooit getest · [risico]
- **Bevinding:** De pull werkt — de zeven sets landen correct als groepen in de plugin. Maar
  er is nooit *vanuit* de plugin gepusht met deze structuur. Twee constructies zijn exotisch
  genoeg om anders genormaliseerd te worden: de same-set rol-aliassen (`ring: {primary}`) en
  de alpha-modifier (`overlay.scrim: rgba({Base.black}, 0.5)`). Normaliseert de plugin die
  bij een push, dan herschrijft de eerstvolgende Figma-push stil de rollaag, en de
  auto-commit in `tokens-sync.yml` publiceert dat naar main.
- **Volgende zet:** Maak in Figma een triviale wijziging (bv. één primitive), push vanuit de
  plugin naar een wegwerp-branch, en diff `tokens.json` tegen main. Kijk specifiek of
  `{primary}` en `rgba({Base.black}, 0.5)` overleven. Pas daarna vrijuit pushen naar main.
- **Status:** resolved — 2026-08-05: Jeroen heeft gepusht (main `bddfb97`). Beide constructies
  overleefden ongewijzigd, alle zeven sets en `tokenSetOrder` intact, en de build produceert
  byte-identieke output. De plugin deed drie onschadelijke dingen: `"disabled"`-entries uit
  `selectedTokenSets` weggelaten (alleen enabled/source blijven), `$themes` en `$metadata` naar
  het einde van het bestand verplaatst, en de trailing newline weggehaald. Dat de weggelaten
  `disabled`-entries niets breken, is precies waarom de build de mode uit de set-naam leest
  en niet uit `$themes`.

## 2026-08-05 — Token-refactor is nooit visueel geverifieerd · [onzekerheid]
- **Bevinding:** De hele twaalf-stappen-refactor is geverifieerd op CSS-niveau: gecompileerde
  output per app, per selector, per mode, plus contrast-berekeningen. Geen enkel gerenderd
  scherm gezien. In cashflow verschuiven `--muted-foreground`, `--foreground`, `--border`,
  `--input`, `--ring`, `--destructive` en `--secondary` allemaal doordat de app van zijn
  gedrifte handgeschreven kopie naar de gegenereerde waarden gaat. Ik verklaarde de
  `--secondary`-flip "inert" op basis van greps — en juist deze sessie bleek een grep te
  falen op `ScoreBadge`, waar de variant in een variabele berekend wordt in plaats van als
  attribuut te staan.
- **Volgende zet:** cashflow en jobradar naast elkaar in light en dark bekijken, met aandacht
  voor de invoervelden (`border-input` werd lichter), zebra-rijen (`bg-muted` werd sterker)
  en de foutmeldingen (`text-destructive`).
- **Status:** resolved — 2026-08-05: gedaan in Chrome, alle drie de apps, beide modes. Naast
  het bekijken is er per pagina een contrast-sweep over elk tekst-element gedraaid (kleur vs.
  effectieve achtergrond, AA-drempel naar tekstgrootte). cashflow 1962 elementen, portfolio 214,
  jobradar volledig: de **enige** faalklasse is `--primary` (zie de entry hieronder). Alle
  gemigreerde rollen kloppen: `border-input` = Neutral.800, zebra `bg-muted` zichtbaar maar
  subtiel, de geïnverteerde chip (`bg-foreground`/`text-background`) leest goed in beide modes,
  en de 17 herschreven SVG-fills in de waterfall renderen correct. Eén echte bug gevonden en
  gefixt: `color-scheme` ontbrak, waardoor native checkboxes en scrollbars in dark wit bleven.
  Twee valse alarmen uit mijn eigen meting genoteerd: een sweep vlak na het omzetten van de
  `dark`-class meet midden in `transition-colors` (meet ná een reload in de doelmode), en
  `input[class*="border-input"]` matcht ook de checkbox, die geen border-breedte heeft.

## 2026-08-05 — --primary haalt AA niet, en het raakt echte tekst · [risico]
- **Bevinding:** Bij de token-refactor is `--primary` naar `Primary.600` gezet; wit erop meet
  4.27:1, onder de 4.5 die AA voor normale tekst vraagt. Dat was toen een theoretisch punt.
  De visuele verificatie maakt het concreet: het is de **enige** contrastfout die over drie
  apps en beide modes overblijft, op acht echte plekken. In cashflow drie links
  ("Finaliseren →", "+ Toevoegen", "+ Nieuwe spaarpot", 4.16–4.42:1), in portfolio vijf
  (de eyebrow "UX/UI DESIGNER · UMANEX", "Alle cases", "Bekijk mijn parcours", en de gevulde
  knop "Kennismaken" met wit op primary). jobradar haalt het wel — die overschrijft primary
  naar blauw. Het gaat dus niet om één randgeval maar om de merkkleur als tekstkleur.
- **Volgende zet:** Productbeslissing van Jeroen. `Primary.700` (#C43737) geeft 5.32:1 en is
  één alias in `Theme/light` + `Theme/dark`. Alternatief: `--primary` op 600 houden voor vlakken
  en een aparte rol voor tekst-op-achtergrond introduceren; dat is meer tokens maar houdt de
  merkkleur op vlakken helderder.
- **Status:** resolved — 2026-08-05: Primary.700 in light (5.32:1). In dark ging 700 de
  verkeerde kant op — daar staat `text-primary` op een bijna-zwarte achtergrond, dus 700 zakte
  naar 3.34 — en werd het `Primary.400`. Niet 500: dat haalde 5.16 op de card maar 4.27 op een
  `bg-muted`-zebrarij, en die is het lichtste oppervlak. `primary-foreground` in dark werd
  `Neutral.950`, zoals success/warning/destructive daar al deden. `ring`, `sidebar-primary` en
  `sidebar-ring` volgden vanzelf omdat ze de rol aliassen. Geverifieerd met de contrast-sweep:
  cashflow 0 fouten in beide modes (1962/1954 elementen), portfolio 0 met alle reveal-wrappers
  geforceerd zichtbaar.

## 2026-08-05 — Semantic/dark is afgeleid, niet ontworpen · [aanname]
- **Bevinding:** Elke dark-waarde in `Theme/dark` en `Semantic/dark` is door mij gekozen door
  een plausibele primitive te prikken en daarna het contrast te meten. Contrast is een
  ondergrens, geen ontwerp. `finance-negative` is in dark `Destructive.400` (#F87171) — een
  vrij felle zalm die op een dichte financiële tabel eerder alarmerend dan informatief kan
  lezen. Er ligt geen dark-design naast.
- **Volgende zet:** Bij het eerste echte gebruik van dark mode in cashflow: de finance-rollen
  beoordelen als *set* i.p.v. per token. Bevalt het niet, dan is het één alias per rol in
  `Semantic/dark`.
- **Note (2026-08-05):** bewust als todo aangehouden door Jeroen. Dark mode is nu bruikbaar en
  haalt overal AA; wat openstaat is de esthetische beoordeling, niet een defect. Daar hoort ook
  de score-pill in jobradar bij, die van helder amber (`bg-amber-500`, 2.15:1) naar bruin
  (`bg-warning` = Warning.700, 5.02:1) ging — correcter, maar een zichtbare verschuiving op
  elke kaart.
- **Status:** resolved — 2026-08-08: de cashflow-helft vervalt. Jeroen heeft dark mode voor
  cashflow niet-van-toepassing verklaard en de aanroep is uitgebouwd (toggle, theme-init-script,
  dark-kolom in de harnessen); de `Semantic/*/finance`-rollen in dark worden dus door niets
  meer getoond en hoeven niet als set beoordeeld te worden. De tokensets zelf blijven staan —
  `Theme/dark` draagt portfolio, vyvey en jobradar, en de build faalt op asymmetrie tussen de
  mode-sets. Het jobradar-stuk staat als eigen entry hieronder.

## 2026-08-08 — jobradar score-pill werd bruin door de contrastfix · [onzekerheid]
- **Bevinding:** Afgesplitst van de entry hierboven, waarvan de cashflow-helft vervallen is. De
  score-pill ging van helder amber (`bg-amber-500`, 2.15:1) naar bruin (`bg-warning` =
  Warning.700, 5.02:1) — correcter, maar een zichtbare verschuiving op elke kaart. Esthetische
  beoordeling, geen defect.
- **Volgende zet:** De pill in jobradar naast de kaart beoordelen en beslissen: bruin houden, of
  een eigen rol voor een pil-achtergrond met donkere tekst erop (dan haalt helder amber wél AA).
- **Volgende zet (2026-08-27):** het besluit is gevallen — een **eigen rol**, geen bruin. De rol is
  gebouwd en gemeten, maar bewust **niet gemerged**: `Semantic/light|dark → score/mid` (+
  `-foreground`), Warning.500 met Neutral.900 respectievelijk Neutral.950 erop. Gemeten op een
  lokale build met de rol erin: `bg #F59F0B` met `tekst #101828` = **8.32:1** in light en `#0C111D`
  = **8.84:1** in dark. In dark verandert er feitelijk niets — `--warning` was daar al Warning.500.
  Wat het tegenhoudt: `pnpm --filter @umanex/ui figma:check` eist een Figma-variabele per tokenrol
  en draait in CI (`figma:check:selftest`), dus de rol vraagt éérst `score-mid` en
  `score-mid-foreground` in de collectie `Theme` van **Component library**
  (`ko2OuasYxyY2YRD69MYhWX`), met Light/Dark-modes, plus een verse `figma/manifest.json`. Dat kan
  alleen met de Desktop Bridge op dát bestand. Volgorde dus: variabelen in Figma → manifest
  verversen → tokens.json + ScoreBadge in één PR.
- **Check:** `grep -n "'warning'" apps/jobradar/components/ScoreBadge.tsx` — treffer = de pill hangt nog aan de generieke warning-rol (het bruin uit de contrastfix); leeg = er is een eigen rol gekozen en het besluit is gevallen.
- **Afgesloten (2026-09-08):** 31 dagen open en het besluit is allang gevallen — dit is geen sessie-context meer maar werk dat blijft liggen. Verplaatst naar `apps/jobradar/BACKLOG.md` (entry 2026-09-08, "score-pill: eigen rol `score/mid` bouwen"), mét de check als eerste zet en de dwingende volgorde erin.
- **Status:** resolved

## 2026-08-05 — Een nieuwe token-set levert stil geen output · [risico]
- **Bevinding:** `classifySet` in `packages/tokens/build.mjs` noemt alles buiten `Theme/` en
  `Semantic/` een primitive, en primitives hebben sinds deze refactor geen output meer. Voeg
  je straks een set `Spacing` of `Shadow` toe, dan resolvet die netjes, faalt niets, en komt
  er niets uit — precies de stille faalmodus die de rest van deze refactor heeft uitgeroeid.
  De typografie ontsnapt eraan omdat ze een expliciete eigen pass heeft.
- **Volgende zet:** Bij het toevoegen van de eerste nieuwe as (spacing is de meest
  waarschijnlijke): een expliciete allow-list van bekende primitive-sets in `classifySet`,
  die gooit op een onbekende set in plaats van hem stil als primitive te classificeren.
- **Status:** resolved — 2026-08-05: gedaan, en het gat bleek breder dan hier beschreven. Er
  zaten drie stille paden in `classifySet`, niet één: (1) een nieuwe as buiten de rolgroepen
  werd primitive zonder output, (2) een kale `Semantic` — de setnaam van vóór de refactor —
  idem, en (3) `Theme/<onbekende suffix>` werd als mode-blind behandeld en zou zijn waarden in
  `:root` zetten, over de light-rollen heen. Dat derde pad gaf dus *foute* output in plaats van
  ontbrekende. Alle drie gooien nu, met een boodschap die de twee uitwegen noemt. Geverifieerd
  door elk pad uit te lokken, plus een positieve test dat een nieuwe rolgroep via `ROLE_GROUPS`
  wel gewoon werkt en dat de symmetrie-guard hem meteen meedekt.

## 2026-08-05 — Guard-baseline en dode eslint-config · [debt]
- **Bevinding:** Twee dingen die eruitzien als handhaving maar het niet zijn. (1) De
  `BASELINE` in `packages/tokens/scripts/guard.mjs` bevat twee `rounded-[2px]`/`[3px]`-sites;
  baselines groeien in de praktijk aan tenzij iemand ze bewaakt. (2) `packages/config/eslint`
  is flat-config (ESLint 9-stijl) in een repo die ESLint 8 + `.eslintrc` + `next lint` draait,
  en wordt door niets geconsumeerd. Ik heb er deze sessie omheen gewerkt door de regels per
  app te zetten, maar het bestand staat er nog en ziet eruit alsof het werkt.
- **Volgende zet:** Ofwel een radius-schaalstap toevoegen zodat de baseline leeg kan, ofwel de
  twee sites accepteren en de baseline bevriezen met een teller-check. En `packages/config/eslint`
  ofwel migreren naar flat config plus bedraden, ofwel verwijderen.
- **Deel 1 resolved (2026-08-05):** de baseline is leeg. De vier sites (`rounded-[2px]` in
  `VarianceChart`, `rounded-[3px]` in `MonthCard`) staan op `rounded-sm` — 4px i.p.v. 2 en 3,
  op een 8px-hoog balkje en een mini-chip niet waarneembaar. Een schaalstap toevoegen voor vier
  plekken zou de schaal aan de code aanpassen i.p.v. omgekeerd.
- **Deel 2 resolved (2026-08-05):** de triplicatie is weg. `packages/config/eslint/tokens.cjs`
  is één eslintrc-shareable config; de drie apps extenden hem via een `.eslintrc.js` met
  `require.resolve`. Dat laatste is nodig omdat ESLint 8 op een kale `extends`-naam zijn eigen
  conventie toepast en `@umanex/eslint-config-config` gaat zoeken — Node resolvet het subpath
  wél, dus een absoluut pad uit `require.resolve` werkt en een `../../`-pad is niet nodig.
  `.cjs` omdat `packages/config` `type: module` is en ESLint shareable configs met `require()`
  laadt. Geverifieerd: 6/6 regels vuren in alle drie de apps. De set groeide van 5 naar 6 —
  `rounded-[Npx]` zat alleen in `guard.mjs`, niet in ESLint.
- **Restant resolved (2026-08-05):** `eslint/next.js` en `eslint/react-library.js` verwijderd,
  samen met hun `exports`-entries. Ze waren flat-config in een ESLint 8-repo, door niets
  geconsumeerd, en importeerden plugins die `packages/config` niet declareert — kapot én
  misleidend. `packages/config/eslint` bevat nu alleen nog `tokens.cjs`, dat wél gebruikt wordt.
- **Status:** resolved

## 2026-08-05 — Visuele regressie-harness ontbreekt · [idee]
- **Deel 2 resolved (2026-08-05):** `packages/tokens/scripts/contrast.mjs` draait in CI. Toetst
  elk vlak tegen zijn eigen tekstkleur, en elke vrije tekstrol tegen elk oppervlak waar hij op
  kan landen — 96 combinaties. Geen browser nodig, dus geen nieuwe dependency. Het is bewust een
  SUPERSET: hij weet niet welke combinaties de apps echt gebruiken, dus een treffer is altijd
  echt, maar hij dekt geen component-specifieke fouten. Hij vond meteen twee dingen die de
  handmatige DOM-sweep miste: `destructive` op een `muted`-rij in light (4.38:1, en
  `text-destructive` staat 19× in cashflow) en `sidebar-primary-foreground` op `sidebar-primary`
  in dark (2.74:1 — mijn eigen fout: `sidebar-primary` aliast de rol, de foreground stond nog op
  wit). Beide gefixt. Negatief getest tegen de twee echte bugs van deze sessie.
- **Deel 1 resolved (2026-08-05):** `apps/cashflow/scripts/render-screens.tsx` +
  `pnpm --filter cashflow render:screens`. Zet de 43 rollen als swatch-matrix, de
  @umanex/ui-primitives in al hun varianten, de typeschaal, en de pure cashflow-componenten
  (SectionBar, StartBalanceRow, BalanceFooter in vier standen, RunwayCard in vier standen) in
  light én dark naast elkaar in één HTML-bestand — geen server, geen sessie, geen store. De
  swatch-lijst wordt uit `theme.css` gelezen, dus hij groeit mee met de tokens in plaats van
  een handgeschreven lijst te zijn die uit de pas loopt. `MonthCard` valt af: die hangt aan
  dnd-kit en de store.
- **Onderweg gevonden:** `render-charts.tsx` was al kapot (`React is not defined`) — de
  app-tsconfig zet `jsx: "preserve"` omdat Next JSX zelf transformeert, en tsx/esbuild laat het
  dan staan. Opgelost met `scripts/tsconfig.json` die `react-jsx` zet; beide scripts draaien er
  nu op.
- **Deel 3 resolved (2026-08-07):** de DOM-sweep is geautomatiseerd. `playwright` als
  devDependency op cashflow, `apps/cashflow/scripts/dom-sweep.mjs`, draait in CI achter
  `pnpm --filter cashflow verify:visual`. Hij loopt elk element met eigen tekst af, composit
  de effectieve achtergrond door de ouderketen (alpha én `opacity` per laag — "eerste
  ondoorzichtige wint" geeft daar het verkeerde antwoord), en schaalt de AA-drempel naar
  tekstgrootte en -gewicht. De twee meetfouten van de handmatige ronde zitten als regel
  ingebakken: nooit tijdens een mode-wissel meten (de harness zet light en dark als twee
  statische kolommen, plus transitions uit), en meten op eigen tekst-nodes in plaats van op
  class-namen (dat was de checkbox die `input[class*="border-input"]` meeving).
  Stand: 451 tekstelementen, 0 fouten.
- **Onderweg gevonden (2026-08-07):** de eerste run gaf vier treffers, alle vier tooling en
  geen app-bug — precies waarom een nieuwe guard eerst getrieerd moet worden voor je hem
  vertrouwt. (1) Vijf "Aa"-swatches meldden wit-op-wit: `render-screens.tsx` zette elke
  `x-foreground` als losse letter op de paginakleur, terwijl die rol per conventie op `x`
  hoort. De swatch toont nu het páár — een echte verbetering van de harness, niet een
  onderdrukte melding. (2) De `disabled`-knop zakte naar 2.24:1 door `disabled:opacity-50`;
  WCAG 1.4.3 zondert inactieve componenten expliciet uit, dus die uitzondering staat nu in de
  sweep (en wordt geteld, niet stil overgeslagen).
- **Nog open:** `MonthCard` en de modals blijven ongedekt — die hangen aan dnd-kit en de
  store en staan niet in de harness. Het drukste scherm van de app is dus nog steeds nooit
  machinaal nagekeken. Zie `apps/cashflow/HANDOFF.md` voor de drag & drop-kant daarvan.
- **Bevinding:** De verificatie-as die deze hele sessie miste. `apps/cashflow/scripts/render-charts.tsx`
  doet dit al voor de grafieken: componenten met synthetische data naar een los HTML-bestand
  renderen, buiten de login gate om. Datzelfde patroon uitgebreid naar de kern-componenten,
  met een light- en een dark-variant naast elkaar, had elke kleurverschuiving van deze
  refactor zichtbaar gemaakt zonder in te loggen.
- **Volgende zet:** `scripts/render-screens.tsx` naar het model van `render-charts.tsx`, met
  beide modes naast elkaar. Ook bruikbaar als input voor `ux-audit` en voor `code-naar-figma`.
- **Status:** resolved — 2026-08-07, in drie delen (zie hierboven). Wat overblijft is geen
  ontbrekende harness meer maar een dekkingsgat: `MonthCard` en de modals.

## 2026-08-05 — Geen brand-laag: heropenen bij een tweede merk · [aanname]
- **Bevinding:** De keuze om géén brand-/merklaag te bouwen rust op één aanname: jobradar is
  de enige app die van de umanex-rollaag afwijkt, en dat blijft zo. De override is vandaag zes
  declaraties per mode in `apps/jobradar/app/globals.css`. Komt er een tweede afwijkend merk
  bij, dan wordt dat twee losse blokken die elk apart kunnen driften — precies het probleem
  dat deze refactor bij de handgeschreven `globals.css`-kopieën heeft opgelost.
- **Volgende zet:** Bij een tweede afwijkend merk: het afgewezen brand-laag-voorstel opnieuw
  bekijken (staat in de synthese van de analyse-workflow), met per-merk rollagen i.p.v. een
  alias-overlay — die laatste lost een omgekeerde rolsemantiek niet op.
- **Status:** resolved — 2026-08-05: niet van toepassing verklaard door Jeroen. Er komt geen
  tweede afwijkend merk in beeld, dus de zes overrides in `apps/jobradar/app/globals.css`
  blijven de hele oplossing. Blijft hier staan als spoor: kantelt dat ooit, dan is dit het
  vertrekpunt.

## 2026-08-25 — De potverdeling in het businessplan is met de hand afgeleid, niet uit de app gelezen · [onzekerheid]
- **Bevinding:** De splitsing €17.489 in provisiepotten tegenover €2.828 vrij — waarop de runway en de hele buffer-redenering in het businessplan staan — heb ik zelf berekend als `monthlyAmount × maanden − opgenomen` uit de JSONB, niet uit wat de app zélf toont. Dat is een tweede implementatie van precies de rekenkern die tussen juni en augustus veertien fix-commits nodig had (dubbele aftrek, subtotalen die niet sloten, doorrol tussen maanden).
- **Check:** Open de app en lees de potstanden van augustus 2026 af; tel ze op. Komt het totaal op €17.489 ± €50, dan klopt mijn afleiding. Wijkt het af, dan verschuift de runway en elke bufferdatum in het businessplan mee.
- **Volgende zet:** Eén keer aflezen en vergelijken. Dit is de #1 eerste zet van de volgende sessie, want het draagt de kop van het document.
- **Status:** open

## 2026-08-25 — De runway van 0,85 maand rekent privé sparen als onvermijdelijk · [aanname]
- **Bevinding:** Ik nam vaste uitgaven plus het volledige maandbudget (€7.968) als wat doorloopt zodra de omzet stopt. Daar zit €500 privé sparen en €500 vrije uitgave in, en dat is precies wat je als eerste stopzet. Strikt genomen is de onvermijdelijke last €6.968 en de runway 0,97 maand in plaats van 0,85.
- **Check:** `grep -c "0,85 maand" businessplan-artifact` — of eenvoudiger: staat er in deel 7 nog 0,85, dan is de correctie niet doorgevoerd. Het verschil is klein maar het is een kopcijfer, en te laag oogt hier alarmerender dan het is.
- **Volgende zet:** Bepalen welke budgetposten je in een noodscenario écht stopzet, en het getal daarop herzien. Dat is dezelfde vraag als de vast/variabel-splitsing die al in het plan staat.
- **Status:** open

## 2026-08-25 — Het rekenmodel achter het businessplan bestaat alleen in de scratchpad · [debt]
- **Bevinding:** Elk cijfer in het businessplan komt uit wegwerpscripts in de sessie-scratchpad — de scenariotabellen, de kasopbouw, de driejarenprojectie, het besparingsargument. Die map is sessie-lokaal en verdwijnt. Het artifact draagt de uitkomsten maar niet de afleiding, dus een volgende herrekening begint van nul en kan stil van deze afwijken.
- **Check:** `ls scripts/plan-model.* 2>/dev/null || echo ontbreekt` in de repo-root — ontbreekt = het model is nog steeds nergens vastgelegd.
- **Volgende zet:** Eén gecommit script dat de kostenbasis uit de cashflow-app leest en de kerncijfers van het plan opnieuw uitrekent. Dan wordt het artifact een momentopname van iets herhaalbaars in plaats van een eindpunt.
- **Opgelost 2026-08-27:** `scripts/plan-model.mjs` bestaat (238 regels, gecommit 2026-08-25 — dezelfde dag als dit item, dus het werk is gedaan zonder het item te sluiten). Niet alleen op bestaan getoetst maar gedraaid: het model rekent de kostenbasis uit (`vast €6.261 + budget €1.706 + provisies €7.289 = €15.257`), en `--selftest` bewijst dat invariant 3 afgaat op een opgewekte afwijking van €500. Dat laatste is het punt — het item vroeg om een herhaalbaar model, niet om een script dat toevallig een getal drukt.
- **Status:** resolved

## 2026-08-25 — De bezoldigingsdrempel kan al voor inkomstenjaar 2026 bijten · [risico]
- **Bevinding:** Het verlaagde tarief van 20% vraagt een bezoldiging van €51.000; die van 2024 was €46.258. De uitzondering "bezoldiging ≥ belastbaar resultaat" dekt dat, want het resultaat was €13.896 — maar alleen zolang het resultaat onder de bezoldiging blijft. Het businessplan plaatst de beslissing in Q4 2027; komt het resultaat van 2026 onverwacht boven €46.258 uit, dan lag de deadline al op 31 december 2026.
- **Check:** Vraag de boekhouder het verwachte belastbaar resultaat 2026. Onder €46.258 = geen actie nodig dit jaar; erboven = de beslissing moet vóór 31 december vallen en niet volgend jaar.
- **Volgende zet:** Eén mail naar de boekhouder met die ene vraag. Kost niets en sluit een deadline van vier maanden.
- **Status:** open

## 2026-09-08 — Een gepubliceerde library nodigt uit tot bewerken; de keten is eenrichting · [risico]
- **Bevinding:** Beide design-system-bestanden (`QkRgMc7Quqtbow71DiYa1n` voor RowTrack, `ko2OuasYxyY2YRD69MYhWX` voor umanex) zijn gebouwd op de regel *code is de bron, Figma de ontvanger* — en de builder leegt elke pagina vóór hij bouwt. RowTracks bestand is nu als library gepubliceerd en gekoppeld in `RowTrack - Design`. Publiceren nodigt uit tot bewerken ín Figma, en dat is precies wat deze keten niet aankan: een bewuste wijziging daar wordt bij de volgende herbouw zonder waarschuwing overschreven, of door `figma:check` als drift gemeld terwijl het intentie is. Het onderscheid tussen "drift" en "iemand heeft hier iets bedoeld" bestaat nergens in het systeem.
- **Check:** `grep -n 'kind.remove()\|children\]) kind.remove' apps/rowtrack/figma/builder.js` — treffer = de builder leegt nog steeds elke pagina, dus een Figma-bewerking overleeft de eerstvolgende herbouw niet.
- **Volgende zet:** Met Jeroen afspreken wat een bewerking ín Figma betekent. Drie richtingen: (a) de regel expliciet maken in het bestand zelf, bijvoorbeeld met een beschrijving op elke pagina die zegt dat hij gegenereerd is; (b) de builder alleen laten overschrijven wat hij zelf gemaakt heeft en handmatige nodes laten staan; (c) accepteren dat het eenrichting blijft en de library alleen voor *gebruik*, niet voor *bewerking*, bedoelen.
- **Status:** open
