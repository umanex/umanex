# RowTrack — Storybook + gekoppeld Figma Design System

- **Datum:** 2026-09-07
- **Type:** feature
- **Project:** rowtrack
- **Klant:** umanex (eigen product)
- **Status:** gebouwd — 2026-09-07

> Bewust **niet** `gevalideerd`: 40 van de 43 acceptatie-items staan op `[x]` mét bewijs, drie
> niet. Eén is echt niet gehaald (85 van 233 tekstnodes hangen aan geen text style, omdat hun
> font/maat/spatiëring-combinatie geen token heeft — D6), en twee dragen
> `[NIET TE VERIFIËREN]` omdat de meetbare as ontbreekt (Dynamic Type en landschap zijn
> alleen op toestel te toetsen — G6, G7). De EXIT-regel uit `.umanex-os/CLAUDE.md` vraagt dat
> élk item op bewijs afgevinkt is; drie open items betekent `gebouwd`.

---

```
TASK:        Een Storybook voor de 34 RowTrack-componenten, gekoppeld aan het Figma-bestand
             "RowTrack — Design System" (QkRgMc7Quqtbow71DiYa1n), met een guard die de sync
             tussen beide meet in plaats van hem te beweren.

CONTEXT:     apps/rowtrack/CLAUDE.md → Design-systeem-bron zegt vandaag "Storybook: geen",
             met de reden erbij: een gedeelde Storybook vraagt @storybook/react-native of een
             react-native-web-target, en dat is een eigen beslissing. Die beslissing is nu
             genomen (react-native-web-vite). packages/ui is het precedent — pagina per
             component, deep-link per story, manifest als neergeslagen Figma-staat, guard met
             tegenproef — maar RowTrack heeft een eigen tokenbron en is dark-only, dus de
             rollaag en de collectie-indeling verschillen.

ELEMENTS:    apps/rowtrack/.storybook/ (main.ts + preview.tsx, framework react-native-web-vite)
             33 × components/**/<Naam>.stories.tsx, elk met parameters.figma.url
             components/__mocks__/ voor de 12 @/lib-afhankelijke componenten
             figma/manifest.json — de neergeslagen Figma-staat (schema 2)
             scripts/figma-sync-check.mjs + figma-sync-selftest.mjs + geometry-parity.mjs
             Figma: 33 pagina's + 1 tokens-pagina, collecties uit tokens.json
             refs-entry in packages/ui/.storybook/main.ts

BEHAVIOUR:   Storybook op :6007 in de browser. Per component een docs-pagina met een
             playground-story waarvan de argTypes exact de variant-assen van de Figma
             component set zijn — dat is de join-sleutel van de parity-as. Elke docs-pagina
             draagt een "Open in Figma"-link naar de primary node van zijn eigen pagina.
             De richting is éénzijdig: code is de bron, Figma de ontvanger. tokens.json
             blijft het Tokens Studio sync-target en wordt door deze taak niet aangeraakt.

CONSTRAINTS: React Native 0.81.5 / React 19.1.0 / Expo SDK 54, gerenderd via react-native-web
             0.21.2. Storybook 10.6.0 — zelfde major als packages/ui (^10.5.10), anders kan
             de ref niet hangen. Dark-only: de tokenbron heeft géén mode-as, dus geen
             theme-toggle en single-mode collecties in Figma. Iconen uitsluitend
             @expo/vector-icons (Ionicons), nooit lucide. Geen hardcoded kleur, maat, radius
             of font in een story — alles via @/constants. Figma-schrijfwerk uitsluitend via
             Figma Console MCP (figma_execute); read-back van verse edits uitsluitend via de
             runtime-klasse, nooit via de REST-tools.
```

---

## Uitgangssituatie — gemeten 2026-09-07, niet aangenomen

**Figma-bestand `QkRgMc7Quqtbow71DiYa1n` ("RowTrack — Design System")**, gelezen via de
Desktop Bridge (`figma_execute`, runtime-klasse):

| | |
|---|---|
| Pagina's | één: `🧩 Components`, **0 kinderen** (Jeroen verwijderde de Button op 2026-09-07) |
| Variabelen | 195 in 3 single-mode collecties: `primitives` (81), `semantic` (104), `components` (10) |
| Text styles | 20 — families: Inter (11), Barlow Condensed (5), JetBrains Mono (4) |
| Effect styles | 0 |

**De 195 variabelen horen niet bij RowTrack.** Dat is geen naamkwestie maar een andere
merkidentiteit, op drie onafhankelijke assen gemeten:

| As | Figma-bestand | `apps/rowtrack/tokens/tokens.json` |
|---|---|---|
| Body-font | `Inter` (`primitives/typography/fontFamily/body`) | `Albert Sans` + `Source Serif Pro` — Inter komt nergens voor |
| Kleurramps | `blue/50…950`, `green/500`, `amber/500`, `neutral/…` | `neutral`, `red`, `gold`, `alpha` — geen blue/green/amber |
| Accent | de verwijderde Button vulde `rgb(0,212,255)` cyaan | `Theme/accent/default` = `{color.red.600}` = **#F05454** |

Naam-dekking als vierde, zwakkere signaal: 150 van de 195 Figma-variabelen hebben geen
tegenhanger in `tokens.json`, en van de 51 `Theme/`-rollen zitten er **3** in Figma
(`bg/base`, `bg/elevated`, `radius/input`). Die drie treffers zijn tegelijk de positieve
controle op de matcher — hij kán groen worden, dus de 150 zijn geen instrumentfout.

**Eén tegenspraak, en hoe ze opgelost is.** De namen in de `semantic`-collectie
(`background/bg-*`, `text/text-*`, `brand/brand-*`, `status/*`) zijn géén verzinsel: ze
spiegelen exact de compat-aliassen die `constants/colors.ts` naast de rollaag exporteert
(`background = { ...bg, surface: bg.elevated }`, `text`, `brand`, `status`). De structuur
komt dus wél uit RowTrack. Alleen de wáárden niet — en dat is met de aliassen uitgelezen,
niet met de namen:

| | Figma | RowTrack (`constants/colors.ts`) |
|---|---|---|
| `neutral/0` | `#FFFFFF` | `#000000` — omgekeerd |
| `neutral/500` | `#64748B` (Tailwind Slate) | `#3A3E48` |
| `neutral/950` | `#0A0A0F` | `#15171C` |
| `bg-base` → | `neutral/950` = `#0A0A0F` | `bg.base` = `#15171C` |
| `brand-primary` → | `blue/300` = `#00D4FF` | `accent.default` = `#F05454` |

De spacing-alias loopt bovendien één stap verschoven (`space-1 → spacing/2`, …,
`space-16 → spacing/11`, `space-20 → spacing/space-12` — een semantische die naar een
semantische wijst), en de Figma-spacingschaal is index-genummerd (`0…12`) waar RowTrack
een waarde-genummerde schaal heeft (`0, 2, 4, 6, 8, …, 28`).

Conclusie: de rolstructuur is overgenomen, het palet en de schaal eronder niet. Het bestand
is dus niet "bijna goed" maar consequent van een ander systeem — wat de keuze om te
hergenereren bevestigt in plaats van hem te verzachten.

**Codekant:** 34 `.tsx`-bestanden in `apps/rowtrack/components/`, maar **33 componenten** —
`PaceZone.tsx` exporteert `getPaceZone`, een pure functie zonder JSX, herge-exporteerd via
`components/workout/index.ts` en gebruikt door `lib/hooks/useGoalProgress.ts`. Het is geen
component, krijgt dus geen story en geen Figma-pagina, en dat staat als expliciete
afschrijving in de acceptatielijst in plaats van als gat. Gemeten 2026-09-07 door alle 34
modules te renderen en hun exports af te lezen, niet door de bestandsnamen te tellen —
`KPI_single.tsx` bleek in dezelfde meting `KpiSingle` te exporteren. Van de 33 componenten
zijn er 22 zuiver presentational en 11 met een `@/lib`-import (`BleStatusBar`, `GoalProgressCard`,
`GoalSegments`, `GoalSheet`, `HealthConsentScreen`, `HrStatusBar`, `SplitsList`,
`WheelPicker`, `WorkoutCard`, `workout/ActivePhase`, `workout/DeviceSelectionModal`,
`workout/IdlePhase`). Native-module-gebruik: `@expo/vector-icons` in 13, `expo-linear-gradient`
in 4, `react-native-safe-area-context` in 4, `react-native-reanimated` in 2, `expo-haptics`
in 2. Géén `react-native-ble-plx` en géén `expo-screen-orientation` in `components/`.

**Bron voor de Figma-generatie:** `packages/rowtrack-tokens/build/_merged.json` draagt de
opgeloste tokenboom (dezelfde bron, referenties uitgerekend). `build/roles.mjs` heeft de
rollijst per soort. De RN-helft die de Storybook-render effectief gebruikt is
`apps/rowtrack/constants/`, gegenereerd door `apps/rowtrack/style-dictionary.config.mjs`.

---

## Open vragen

Geen. De vier kritische items zijn beantwoord — component-typologie, states, interactie en
edge cases staan hieronder in Aannames respectievelijk in de Acceptatie-lijst.

## Aannames

- `[ASSUMPTION: component-typologie]` De typologie is tweeledig en volgt packages/ui: in code
  een CSF3-story per component met één `Playground` waarvan de argTypes de variant-assen zijn;
  in Figma één pagina per component met één primary `COMPONENT_SET` (of `COMPONENT` waar er
  geen assen zijn). Een component zonder visuele as krijgt géén kunstmatige as.
- `[ASSUMPTION: interactie-modaliteit]` De componenten zijn touch-first (`TouchableOpacity`,
  `activeOpacity={0.8}`). In de browser mapt react-native-web dat op pointer-events; de
  Storybook-interactie is dus muis/toetsenbord op touch-doelen. Interactieve *states* worden
  als args gestuurd, niet als echte hover — RN kent geen hover, dus een `hover`-as in Figma
  zou een web-verzinsel zijn en komt er niet.
- `[ASSUMPTION: dark-only]` Geen theme-toggle in preview.tsx en single-mode collecties in
  Figma, omdat de bron geen mode-as heeft. Een light-variant wordt niet verzonnen — zelfde
  regel als `packages/rowtrack-tokens/build.mjs` al toepast.
- `[ASSUMPTION: mocks]` De 12 `@/lib`-afhankelijke componenten krijgen mocks op module-niveau
  (Vite `resolve.alias`), niet een herschreven component. De component blijft ongewijzigd;
  alleen zijn datalaag wordt in de story vervangen.
- `[ASSUMPTION: figma-pagina-indeling]` 33 componentpagina's plus één `Tokens`-pagina die de
  rollaag toont. Geen submappen-hiërarchie — `packages/ui` doet één pagina per component en
  de guard ankert daarop.

---

## Acceptatie

Elk item is één meting. Afgevinkt met het bewijs ín de regel; een vinkje zonder `bewijs:`
telt als open. Alle metingen van 2026-09-07, op de branch `feature/rowtrack-storybook-figma`.

### A — Storybook bestaat en dekt

- [x] `apps/rowtrack/.storybook/main.ts` draagt framework `@storybook/react-native-web-vite` — bewijs: grep op het bestand, één treffer
- [x] Elk van de 33 componenten heeft een `*.stories.tsx` naast zich — bewijs: as `[dekking]` van `figma:check`, "33 van 34 bestanden hebben een story", exit 0
- [x] `PaceZone.tsx` heeft géén story en géén Figma-pagina — bewijs: afgeschreven as, zichtbaar als `-- [uitgesloten] PaceZone` in de guard-output; de module exporteert enkel `getPaceZone` (geen JSX), gemeten op de gerenderde exports
- [x] `pnpm --filter rowtrack build-storybook` eindigt op exit 0 — bewijs: `out=$(…); rc=$?` → 0
- [x] Elk van de 197 stories rendert in de browser zonder console-error — bewijs: `render:sweep`, "alle 197 stories renderen: geen console-fout, geen lege render", exit 0
- [x] De `@/lib/supabase`-mock wordt gebruikt in plaats van de echte module — bewijs: de smoke-render gaf 1 console-fout vóór de mock en 0 erna, met alle 33 modules in de DOM
- [x] `packages/ui/.storybook/main.ts` draagt een `refs`-entry naar RowTracks Storybook — bewijs: grep, `refs.rowtrack.url = http://localhost:6007`

### B — De web-render is trouw aan de app

- [x] De vier font-families zijn geladen in de browser-render — bewijs: `document.fonts.load()` gevolgd door `check()` per family, vier keer `true`
- [x] Geen `*.stories.tsx` bevat een kleur-hex of een font-naam die niet uit `@/constants` komt — bewijs: as `[hardcoded]` van `figma:check`, 33 stories schoon
- [x] De gerenderde `Button` (variant=primary, size=lg) is 44px hoog in de browser — bewijs: `getBoundingClientRect().height` = 44, gelijk aan `space['44']`; in dezelfde meting padding 24, gap 10, radius 9999, borderColor `rgb(240,84,84)` = `accent.default`, tekst `AlbertSans_400Regular` 18px letterSpacing −0,27 = `typeStyles.buttonPrimary`

### C — Figma: variabelen en text styles komen uit de bron

- [x] De collecties `primitives`, `semantic` en `components` bestaan niet meer — bewijs: `figma_execute`-nameting direct na het verwijderen gaf `collecties: []`
- [x] De 20 bestaande text styles (11 in Inter) bestaan niet meer — bewijs: dezelfde nameting gaf `textStyles: 0`; de 18 die er nu staan dragen Albert Sans en Source Serif 4
- [x] Elke Figma-variabele is herleidbaar tot een leaf-pad in `tokens.json` — bewijs: as `[token]` van `figma:check`, 250 variabelen, beide richtingen
- [x] Elke Figma-variabele draagt dezelfde wáárde als zijn bron-token — bewijs: as `[tokenwaarde]`, 250 waarden, kleurtolerantie 0,6/255
- [x] Elke Figma text style volgt een `Theme/type/*`-token in grootte, regelhoogte, spatiëring en gerenderde familie — bewijs: as `[typografie]`, 18 styles
- [x] Er staat geen Figma-variabele in het bestand die nergens uit de bron volgt — bewijs: dezelfde as `[token]`, richting Figma → bron, 0 overtollig

### D — Figma: componenten en hun bindingen

- [x] Elk van de 33 componenten heeft een eigen Figma-pagina met precies één primary node — bewijs: as `[pagina]`, 33 componenten; de lege legacy-pagina `🧩 Components` is verwijderd (nameting: 33 pagina's, geen enkele zonder kinderen)
- [x] De variant-assen van elke Figma component set zijn gelijk aan de argTypes-assen van zijn story — bewijs: as `[variant]`, 31 componenten
- [x] Het aantal variant-nodes per set is gelijk aan het product van zijn assen — bewijs: as `[varianten]`, 94 variant-nodes over 15 sets
- [x] Elke story draagt `parameters.figma.url` die naar de primary node van zíjn pagina wijst — bewijs: as `[link]`, 33 deep-links; gegenereerd door `figma:links`, niet met de hand
- [x] Het aantal waarden zonder tokenbinding is bekend en groeit niet — bewijs: as `[binding]`, 38 unieke ongebonden waarden gelijk aan de 38 bekende gaten, elk met een BACKLOG-item
- [ ] Elke tekst-node hangt aan een text style — **niet gehaald**: 85 van de 233 tekstnodes hebben geen `textStyleId`, omdat hun font/maat/spatiëring-combinatie geen `Theme/type/*`-token heeft (13 unieke combinaties, waaronder alles in Barlow Condensed en JetBrains Mono). Zichtbaar als melding in de builder, geteld in `figma/ongebonden.json`, met een BACKLOG-item. Dit is een gat in de tokenbron, geen bouwfout.

### E — De guard meet, en kan rood worden

- [x] `pnpm --filter rowtrack figma:check` eindigt op exit 0 — bewijs: `out=$(…); rc=$?` → 0, tien assen groen
- [x] De guard gaat af op een mutatie die hij hoort te vangen — bewijs: `figma:check:selftest`, elf mutaties, elk exit 1 op precies zijn eigen as
- [x] De guard zwijgt op een mutatie die géén drift is — bewijs: dezelfde selftest, twee controle-mutaties (bestandsnaam hernoemen, een named story hernoemen), beide exit 0
- [x] Elke as die niets kon meten meldt zichzelf als overgeslagen — bewijs: de `~~`-regels in de guard-output; bij een volledige invoer zijn het er nul
- [x] De slotregel noemt de assen en het bereik, en zegt niet "in sync" — bewijs: grep op de output, de zin begint met "10 checks groen — dekking, pagina's, …" en somt daarna op wat níet gemeten is

### F — Geometrie-parity: Figma naast de browser

- [x] Per variant-node zijn hoogte, horizontale padding, gap, radius, randbreedte en opacity gelijk aan de browser-render — bewijs: `pnpm --filter rowtrack parity`, 109 variant-nodes, 1066 velden, nul verschillen, tolerantie 0,5px
- [x] De aanwezigheid van een vulling, rand of effect is aan beide kanten gelijk — bewijs: dezelfde run, booleaans per node
- [x] De parity-as kan rood worden — bewijs: `parity:selftest` verschuift één hoogte in de Figma-kant en geeft exit 1 met `FAIL Chip[active=true] hoogte: browser 44 tegen Figma 49`; ongemuteerd exit 0
- [x] Breedte en frame-eigenschappen op tekstnodes zijn expliciet uitgesloten met reden — bewijs: de uitsluiting staat met haar meting in `geometry-parity.mjs` (SectionHeader 162,78 tegen 136, TabLabel 69,39 tegen 57 bij identieke familie, grootte en spatiëring)
- [x] Per component staat een Figma-capture naast een browser-screenshot — bewijs: uitgevoerd op Button, Chip en SplitsList via `figma_capture_screenshot` (runtime) naast `scripts/render-shot.mjs`; die vergelijking vond wat de geometrie niet kán vinden, namelijk dat `text-transform: uppercase` niet in de DOM-tekst zit (Figma toonde "500m" waar de browser "500M" rendert, 42 tekstnodes over 12 componenten) — nu opgelost met Figma's `textCase`

### G — Kritische assen: states, interactie, edge cases

- [x] De state-componenten `EmptyState`, `ErrorState`, `ErrorMessage`, `Skeleton` en `GoalCardSkeleton` hebben elk een story én een Figma-pagina — bewijs: as `[dekking]` plus as `[pagina]`, alle vijf aanwezig
- [x] Elk component met een `loading`-prop heeft die state als variant-as — bewijs: as `[variant]`; `Button.loading` en `KPI.loading` staan als as in Figma met beide waarden
- [x] Elk component met een `disabled`-achtige prop heeft die state als variant-as — bewijs: dezelfde as; `Button.disabled` en `DeviceRow.actionDisabled`
- [x] Interactie-as: er is géén `hover`-variant in Figma — bewijs: as `[variant]`, geen enkele set draagt een as met de waarde `hover`; RN kent geen hover, dus die zou een web-verzinsel zijn
- [x] Edge case lange tekst: `Button` met een label van 40 tekens knipt niet af — bewijs: browser-render, `scrollWidth ≤ clientWidth` op de tekstnode (`knipt: false`)
- [ ] Edge case Dynamic Type — `[NIET TE VERIFIËREN — react-native-web negeert maxFontSizeMultiplier, dus de browser-render kan dit gedrag niet opwekken. De cap staat in Button.tsx:107 en is alleen op toestel toetsbaar.]`
- [ ] Landschap-gedrag van `workout/ActivePhase` — `[NIET TE VERIFIËREN — de oriëntatie-as leeft in expo-screen-orientation buiten components/; de browser-render kan hem niet forceren. Blijft een toestel-check, zie CLAUDE.md → Verify-pad.]`

### H — De declaratie volgt de schijf

- [x] `apps/rowtrack/CLAUDE.md` → Design-systeem-bron zegt niet langer `Storybook: geen` — bewijs: grep, de regel luidt nu `pnpm --filter rowtrack storybook` (:6007)
- [x] `pnpm ds:guard` accepteert de declaratie — bewijs: exit 0 met "7/7 apps gedeclareerd en in lijn met de schijf". De guard is op de werktree rood op `apps/dashboard`, maar die map is op deze branch niet getrackt (`git ls-tree -d HEAD apps/` toont hem niet) — het zijn achtergebleven build-artefacten van een andere taak. Tegenproef: map tijdelijk opzij gezet → exit 0
- [x] `pnpm ds:guard:selftest` bewijst dat die guard rood kan worden — bewijs: "11/11 — de guard gaat rood op elk defect en zwijgt op een schone fixture"
- [x] `apps/rowtrack/CLAUDE.md` → Verify-pad draagt de nieuwe commando's — bewijs: grep op `figma:check`, `parity` en `render:sweep` in die sectie, 6 treffers, plus de twee `figma_execute`-recepten

---

## Beslissingsgeschiedenis

- 2026-09-07: Storybook-target vastgelegd op `@storybook/react-native-web-vite` 10.6.0 +
  `react-native-web` 0.21.2, boven de on-device `@storybook/react-native`. Reden: zelfde
  Storybook-major als `packages/ui` (^10.5.10), dus de ref-vorm uit CLAUDE.md kan hangen, en
  een browser-render maakt de geometrie-parity-as meetbaar die on-device met de hand zou moeten.
- 2026-09-07: De 195 bestaande Figma-variabelen en 20 text styles worden verwijderd en
  hergenereerd uit `tokens.json`. Reden: ze dragen een andere merkidentiteit (Inter/cyaan/blauw
  tegen Albert Sans/#F05454), gemeten op drie onafhankelijke assen. Behouden zou Figma tot
  tweede bron van waarheid maken; tokens.json eraan aanpassen zou een rebrand van de app zijn.
- 2026-09-07: Scope is alle componenten, inclusief die met een `@/lib`-import. Tijdens de
  bouw bleek de mock-laag één module groot in plaats van twaalf componenten: alleen
  `lib/supabase.ts` gooit bij module-load. `formatters`, `links`, `personalRecords`,
  `prDisplay` en `ble/types` zijn pure modules die in de browser gewoon draaien.
- 2026-09-07: Het aantal is 33, niet 34 — `PaceZone.tsx` is een functie, geen component.
  Gevonden door de exports te renderen in plaats van de bestandsnamen te tellen.
- 2026-09-07: "100% in sync" is vastgelegd als vier lagen — structuur, tokenwaarden,
  geometrie-parity en een visuele beeldvergelijking ter beoordeling. Die vierde laag is
  bewust géén guard-as: byte-vergelijking van screenshots is in Chromium geen identiteitstoets.
  Dit sluit het HANDOFF-item van 2026-08-25 ("100% in sync is structureel bewezen, niet
  visueel") voor RowTrack; voor `packages/ui` blijft het open.
