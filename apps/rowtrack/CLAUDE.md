# RowTrack — CLAUDE.md

## Project overzicht
React Native (Expo) rowing workout tracker app met BLE connectiviteit,
gamificatie en Supabase backend.

**Stack:** React Native · Expo SDK · Expo Router · TypeScript · Supabase  
**Figma bestand:** T1bGrvIzSNeLyh5CbarATZ  
**Design MCP:** Figma Console MCP (figma-console-mcp van southleft) via Desktop Bridge  

---

## Figma mapping

Voor elk Figma-gerelateerd werk: lees eerst `apps/rowtrack/figma-map.md`
om de juiste node-id te vinden. Niet gokken op basis van componentnaam.

---

## Design tokens

Tokens worden beheerd via Tokens Studio en gegenereerd via `pnpm tokens:build`.

- **Bron (niet handmatig bewerken):** `apps/rowtrack/tokens/tokens.json`
- **Build output (importeren in code):** `apps/rowtrack/constants/`

Gebruik altijd imports uit `@/constants` — geen hardcoded kleuren, spacing, radii of font families.
Voor de beschikbare exports (kleuren, `fontFamily`, `typeStyles`, `space`, `radii`): lees
`constants/index.ts` en de bestanden waar hij naar herexporteert. Niet hier dupliceren — dat drift.

---

## Conventies

### Code
- `StyleSheet.create()` — nooit inline styles
- `TouchableOpacity` voor interactieve elementen, `activeOpacity={0.8}`
- Iconen via `@expo/vector-icons` (Ionicons) — **nooit** `lucide-react-native`
- Import alias: `@/components/...`, `@/lib/...`
- 1 component = 1 bestand, PascalCase bestandsnaam

### Figma workflow
- **Nooit** native Figma Code Connect
- **Altijd** Figma Console MCP (`figma_execute`) voor schrijfoperaties
- **Altijd** `get_metadata` + `get_screenshot` voor lezen
- Figma bestand: `T1bGrvIzSNeLyh5CbarATZ`
- Components pagina: `node-id=21-378`
- Screens pagina: `node-id=0-1`

### BLE
- Rower: FTMS service `00001826`, characteristic `00002ad1`
- HR: Heart Rate service `0x180D`, characteristic `0x2A37`
- Twee notification types: distance/elapsed packet en spm/watts/split packet

### Supabase
- Tabellen: `profiles`, `workouts`, `period_goals`
- Lees het schema live via de `supabase-rowtrack` MCP-server (`list_tables`) — kolomnamen niet
  hier dupliceren, die drift (een gekopieerd schema stond hier maanden verkeerd)
- Let op de servernaam: `supabase-cashflow` wijst naar een ánder project

---

## Design-systeem-bron

Welke laag deze app zijn vorm van krijgt. Gemeten, niet afgeleid: `scripts/design-system-guard.mjs`
toetst elke regel hieronder tegen wat er op schijf staat. "geen" is overal een geldig antwoord,
mits het er staat.

- **Preset:** `geen` — React Native, geen Tailwind; de rollaag komt uit `constants/`
- **Componentbron:** `eigen` — `components/`, op `@/constants` uit `tokens/tokens.json`
- **Storybook:** `geen` — `@storybook/react-vite` draait niet op React Native

Een gedeelde Storybook met `packages/ui` vraagt `@storybook/react-native` of een
react-native-web-target. Dat is een eigen beslissing, geen bijproduct van een componenttaak.

---

## Verify-pad

Wat de `verify`-skill hier kan uitvoeren. Vastgesteld 2026-08-07 door het te draaien, niet door
het af te leiden. Staat er "geen", dan is dat een gat dat gebouwd moet worden — geen vergetelheid.

| Capability | Commando / status |
|---|---|
| **Render vastleggen** | `xcrun simctl io booted screenshot <pad>.png` — werkt. Nooit een UDID hardcoden, die verandert; `booted` is stabiel. Op het fysieke toestel: geen automatisch pad, screenshot met de hand. |
| **Flow aandrijven** | **Maestro 2.8.0** (besluit Jeroen, 2026-08-08). Draaien: `JAVA_HOME=$(brew --prefix openjdk)/libexec/openjdk.jdk/Contents/Home maestro test apps/rowtrack/.maestro/smoke.yaml`. `JAVA_HOME` is niet optioneel — Homebrew's openjdk is keg-only en staat niet vanzelf op `PATH`. Installeren met **`brew install mobile-dev-inc/tap/maestro`**, nooit `brew install maestro`: dat is een gelijknamige cask van runmaestro.ai, een heel ander product. Gemeten 2026-08-08 op simulator `iPhone 17` / iOS 26.5: `smoke.yaml` slaagt (launch + twee asserts, exit 0). Drie valkuilen die hij onderweg blootlegde, zie hieronder. |
| **State forceren** | `app/dev-active.tsx` forceert de active-workout fase. Verder: `supabase/seed/test-account.sql` in de SQL Editor zet `rowtrack-test@umanex.be` terug op een vaste vertreksituatie — `health_consent = null`, lege lichaamsvelden, 4 ritten met bewust verschillende `samples`-vormen. Idempotent, dus ook de reset. |
| **Invariant draaien** | `pnpm --filter rowtrack test` (of `npm run test` in `apps/rowtrack`) draait **alle** suites: `node --test "lib/**/*.test.ts"`. Stand 2026-08-22: 51 tests over 5 suites (`ble/adapterReady`, `ble/hrLink`, `ble/rowerCandidate`, `ble/scan-lock`, `personalRecords`), allemaal groen. Node 24 draait TypeScript zonder transpiler en heeft `node:test`/`node:assert` ingebouwd, dus dit kost geen dependency. Werkt op modules zonder path-alias of RN-import (`bestDistanceTime.ts`, `calories.ts`, `smoothing.ts`, `period.ts`, `personalRecords.ts`, `ble/scan-lock.ts`, `ble/hrLink.ts`, `ble/rowerCandidate.ts`). Een module die `@/…` importeert lost Node niet op. **Let op:** `node --test lib/` faalt (de runner ziet de map als testbestand) en de suites draaien **niet** in CI — `ci.yml` doet type-check, lint en build, geen tests. Draai ze dus met de hand vóór je een BLE- of berekeningswijziging aflevert. |
| **Verse build** | De app op de simulator is een **dev-client**: zonder Metro (`pnpm dev:rowtrack`) draait hij op wat er toevallig nog in het geheugen zit. Controleer de datum van `~/Library/Developer/CoreSimulator/Devices/<udid>/data/Containers/Bundle/Application/*/RowTrack.app/` vóór je een screenshot als bewijs gebruikt — op 2026-08-07 was die een maand oud en dat is aan de render niet te zien. Na een native wijziging: `expo run:ios --device`, cf. de worklets-les. |

**Drie valkuilen van de flow-as, elk gemeten op 2026-08-08.** Alle drie geven hetzelfde beeld —
een blanco scherm en een gefaalde assert — terwijl er niets mis is met de app. Wie ze niet kent,
rapporteert een vals negatief.

1. **Een verse tree (agent-worktree, `.claude/worktrees/<taak>`) heeft geen `.env`.** Dat bestand is
   gitignored, dus het reist niet mee met `git worktree add`. Zonder `EXPO_PUBLIC_SUPABASE_URL` en `..._ANON_KEY` crasht de app bij het
   opstarten op *"Missing Supabase env vars"* en toont de hiërarchie enkel de statusbalk. Fix:
   `cp "$(git worktree list --porcelain | sed -n '1s#^worktree ##p')/apps/rowtrack/.env" apps/rowtrack/.env`
   (de eerste regel van `worktree list --porcelain` is altijd de hoofdtree) en Metro herstarten.
2. **Het dev-menu van de development build verbergt de app.** Bij de eerste start ná installatie
   verschijnt een onboarding-sheet, en het dev-menu zelf legt zich als aparte laag over de app.
   Maestro ziet dan géén app-inhoud, ook al staat het scherm er visueel achter. `smoke.yaml` klikt
   de sheet voorwaardelijk weg; komt het volledige menu op, herstart dan de app
   (`xcrun simctl terminate booted com.rowtrack.app && xcrun simctl launch booted com.rowtrack.app`).
3. **Metro moet draaien.** De dev-client haalt zijn bundle van `:8081`. Staat Metro niet op, dan is
   het beeld opnieuw blanco — zie ook *Verse build* hierboven.

Bewust géén inloggegevens in `smoke.yaml`. Een flow die verder moet dan het startscherm gebruikt
het testaccount hieronder, met de hand ingevuld.

**Destructieve paden — alleen op het testaccount.** `revoke_health_consent()` wist hartslag uit álle
ritten van de aanroeper en leegt de lichaamsvelden. Op `jeroen@ikbenjeroen.be` is dat onherstelbaar
verlies: draai het daar nooit. Op `rowtrack-test@umanex.be` mag het wél, want
`supabase/seed/test-account.sql` zet de staat in één run terug. Is er om welke reden ook geen
testsessie beschikbaar, val dan terug op de guard toetsen (aanroepen zonder auth, daarna tellen dat
de data er nog staat) of de transformatie op synthetische `jsonb` in een `select`. Zie rail 5 in de
`verify`-skill.

**Migratiestaat: toets het schema, niet het ledger.** Migraties worden hier met de hand in de SQL
Editor gedraaid, dus `list_migrations` kent er 6 van de 11 in `supabase/migrations/`. Alle elf zijn
toegepast — het ledger is stil onvolledig, niet het schema. Een briefing die schrijft "de migratie is
nog niet gedraaid" veroudert daardoor zonder dat iemand het merkt; schrijf de *check* op in plaats
van de *staat*, en toets tegen `information_schema` of `pg_indexes`. Let op: een unique constraint
kan hier een unique *index* zijn — `pg_constraint` alleen bekijken geeft een vals negatief.

---

## Veelgemaakte fouten

| Probleem | Oplossing |
|---|---|
| `topSvgLayout` crash | Gebruik `@expo/vector-icons`, niet `lucide-react-native` |
| BLE PLX old-arch interop | `react-native-ble-plx` uses `RCT_EXPORT_MODULE()`; RN 0.81 interop layer handles this automatically |
| Modal niet fullscreen | Gebruik `<Modal transparent statusBarTranslucent>`, niet `absoluteFillObject` |
| Fonts niet geladen in Figma | `await figma.loadFontAsync(...)` vóór elke `createText()` |
| Tab label verkeerd | Tab heet "Training" (niet "Workout") |
| pod install faalt | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |
| Defensieve fallback vuurt nooit | Een static `import` van een native module evalueert bij module-load, dus vóór je try/catch. Laad hem lazy met `require()` *binnen* de try/catch — enkel dan is "module ontbreekt" opvangbaar. Zie `lib/secureStorage.ts` |
