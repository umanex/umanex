# RowTrack — Storybook + gekoppeld Figma Design System

- **Datum:** 2026-09-07
- **Type:** feature
- **Project:** rowtrack
- **Klant:** umanex (eigen product)
- **Status:** gepland

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

Elk item is één meting. Afvinken met het bewijs ín de regel (`— bewijs: <meting + instrument>`);
een vinkje zonder `bewijs:` telt als open.

### A — Storybook bestaat en dekt

- [ ] `apps/rowtrack/.storybook/main.ts` draagt framework `@storybook/react-native-web-vite` — bewijs: grep op het bestand
- [ ] Elk van de 33 componenten in `components/**/*.tsx` heeft een `*.stories.tsx` naast zich — bewijs: as `[dekking]` van `figma:check`, die beide lijsten telt en het verschil noemt
- [ ] `PaceZone.tsx` heeft géén story en géén Figma-pagina — bewijs: afgeschreven as, de module exporteert enkel `getPaceZone` (geen JSX), gemeten op de gerenderde exports
- [ ] `pnpm --filter rowtrack build-storybook` eindigt op exit 0 — bewijs: exit-status vóór welke pipe ook (`out=$(…); rc=$?`)
- [ ] Elk van de 33 stories rendert in de browser zonder console-error — bewijs: Playwright leest `page.on('console')` per story-id, telling van errors = 0
- [ ] De `@/lib/supabase`-mock wordt gebruikt in plaats van de echte module — bewijs: de smoke-render gaf 1 console-fout vóór de mock en 0 erna, met alle 33 modules zichtbaar in de DOM
- [ ] `packages/ui/.storybook/main.ts` draagt een `refs`-entry naar RowTracks Storybook — bewijs: grep op het bestand plus een geslaagde fetch van de ref-URL

### B — De web-render is trouw aan de app

- [ ] De vier font-families zijn geladen in de browser-render — bewijs: `document.fonts.check()` per family (Albert Sans, Source Serif 4, Barlow Condensed, JetBrains Mono), vier keer true
- [ ] Geen `*.stories.tsx` bevat een kleur-hex, een px-getal of een font-naam die niet uit `@/constants` komt — bewijs: as `[hardcoded]` van `figma:check`, regex over de storybestanden
- [ ] De gerenderde `Button` (variant=primary, size=lg) is 44px hoog in de browser — bewijs: `getBoundingClientRect().height` tegen `space['44']` uit `constants/spacing.ts`

### C — Figma: variabelen en text styles komen uit de bron

- [ ] De collecties `primitives`, `semantic` en `components` bestaan niet meer in het bestand — bewijs: `figma_execute` telt `getLocalVariableCollectionsAsync()` en geen van de drie namen komt voor
- [ ] De 20 bestaande text styles (11 in Inter) bestaan niet meer — bewijs: `figma_execute` leest `getLocalTextStylesAsync()` en geen style draagt family `Inter`
- [ ] Elke Figma-variabele is herleidbaar tot een leaf-pad in `apps/rowtrack/tokens/tokens.json` — bewijs: as `[token]` van `figma:check`, tegen de manifest
- [ ] Elke Figma-variabele draagt dezelfde wáárde als zijn bron-token, niet enkel dezelfde naam — bewijs: as `[tokenwaarde]` van `figma:check`, kleur met tolerantie, scalar exact
- [ ] Elke Figma text style volgt een `Theme/type/*`-token in grootte, regelhoogte, family, gewicht en letterspatiëring — bewijs: as `[typografie]` van `figma:check`
- [ ] Er staat geen Figma-variabele in het bestand die nergens uit de bron volgt — bewijs: dezelfde as `[token]`, richting Figma → bron, met een expliciete `BEKENDE_GATEN`-lijst voor wat bewust ontbreekt

### D — Figma: componenten en hun bindingen

- [ ] Elk van de 33 componenten heeft een eigen Figma-pagina met precies één primary node — bewijs: as `[pagina]` van `figma:check` tegen de manifest, `querySelector`-tel = 1 per pagina
- [ ] De variant-assen van elke Figma component set zijn gelijk aan de argTypes-assen van zijn story — bewijs: as `[variant]` van `figma:check`
- [ ] Het aantal variant-nodes per set is gelijk aan het product van zijn assen — bewijs: as `[varianten]` van `figma:check`
- [ ] Elke story draagt `parameters.figma.url` die naar de primary node van zíjn pagina wijst — bewijs: as `[link]` van `figma:check`
- [ ] Geen node in het bestand draagt een fill, stroke, radius, padding of gap zonder variable-binding — bewijs: as `[binding]` van `figma:check`, geteld over alle nodes van alle 33 pagina's
- [ ] Geen tekst-node draagt een losse fontgrootte in plaats van een text style — bewijs: dezelfde as `[binding]`, `textStyleId` niet leeg per TEXT-node

### E — De guard meet, en kan rood worden

- [ ] `pnpm --filter rowtrack figma:check` eindigt op exit 0 — bewijs: exit-status vóór welke pipe ook
- [ ] De guard gaat af op een mutatie die hij hoort te vangen — bewijs: `figma:check:selftest`, één gemuteerde kopie per as, elke as exit 1
- [ ] De guard zwijgt op een mutatie die géén drift is — bewijs: dezelfde selftest, controle-mutatie op een veld buiten het bereik, exit 0
- [ ] Elke as die niets kon meten meldt zichzelf als overgeslagen in plaats van groen — bewijs: `~~`-regels in de guard-output, geteld
- [ ] De slotregel van de guard noemt de assen en het bereik, en zegt niet "in sync" — bewijs: grep op de output

### F — Geometrie-parity: Figma naast de browser

- [ ] Per variant-node zijn hoogte, horizontale padding, gap, radius, borderbreedte en opacity gelijk aan de browser-render — bewijs: `pnpm --filter rowtrack parity`, join op de variant-naam
- [ ] De aanwezigheid van een vulling, rand of effect is aan beide kanten gelijk — bewijs: dezelfde parity-run, booleaans per node
- [ ] Breedte en verticale padding zijn expliciet uitgesloten met reden in het script — bewijs: de uitsluitingslijst in `geometry-parity.mjs`, met de gemeten reden erbij
- [ ] Per component staat een Figma-capture naast een Playwright-screenshot in de PR — bewijs: de beeldenparen, nadrukkelijk als beoordeling en niet als guard-as

### G — Kritische assen: states, interactie, edge cases

- [ ] De state-componenten `EmptyState`, `ErrorState`, `ErrorMessage`, `Skeleton` en `GoalCardSkeleton` hebben elk een story én een Figma-pagina — bewijs: as `[dekking]`, vijf namen aanwezig
- [ ] Elk component met een `loading`-prop heeft een story die die state toont — bewijs: grep op `loading` in de componentbronnen, elk voorkomen terug te vinden als story-arg
- [ ] Elk component met een `disabled`-prop heeft een story die die state toont — bewijs: dezelfde meting op `disabled`
- [ ] Interactie-as: er is géén `hover`-variant in Figma — bewijs: as `[variant]`, geen enkele set draagt een as met de waarde `hover`
- [ ] Edge case lange tekst: `Button` met een label van 40 tekens knipt niet af binnen de knop — bewijs: browser-render, `scrollWidth ≤ clientWidth` van de tekst-node
- [ ] Edge case Dynamic Type: `Button` cap op `maxFontSizeMultiplier={1.3}` staat in de code — bewijs: grep op `Button.tsx`; `[NIET TE VERIFIËREN — react-native-web negeert maxFontSizeMultiplier, dus de browser-render kan dit gedrag niet opwekken; toetsbaar alleen op toestel]`
- [ ] Edge case nulwaarde: `KPI` met waarde 0 toont "0" en niet een lege cel — bewijs: story-render, tekstinhoud van de waardenode
- [ ] Landschap-gedrag van `workout/ActivePhase` — `[NIET TE VERIFIËREN — de oriëntatie-as leeft in expo-screen-orientation buiten components/; de browser-render kan hem niet forceren. Blijft een toestel-check, zie apps/rowtrack/CLAUDE.md → Verify-pad]`

### H — De declaratie volgt de schijf

- [ ] `apps/rowtrack/CLAUDE.md` → Design-systeem-bron zegt niet langer `Storybook: geen` — bewijs: grep op het bestand
- [ ] `pnpm ds:guard` accepteert de nieuwe declaratie — bewijs: exit-status van de guard
- [ ] `pnpm ds:guard:selftest` bewijst dat die guard nog rood kan worden — bewijs: exit-status van de selftest
- [ ] `apps/rowtrack/CLAUDE.md` → Verify-pad draagt de nieuwe commando's onder Render vastleggen — bewijs: grep op `storybook` in die sectie

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
