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
- **Storybook:** `pnpm --filter rowtrack storybook` (:6007) — `@storybook/react-native-web-vite`

De beslissing die hier tot 2026-09-07 als "geen" stond, is genomen: de componenten renderen
in de browser via **react-native-web 0.21**, op Storybook 10 — dezelfde major als
`packages/ui`, zodat deze Storybook daar als `ref` hangt in plaats van een tweede losse
installatie te zijn. De componenten zelf blijven byte-identiek aan wat het toestel draait;
alleen `lib/supabase.ts` wordt door een mock vervangen (`.storybook/mocks/`), omdat die
module bij load gooit zonder `EXPO_PUBLIC_SUPABASE_*`.

Twee dingen die je moet weten vóór je eraan werkt:

- **De fontlaag is gegenereerd.** `scripts/build-web-fonts.mjs` leest `constants/fonts.ts`
  — zelf gegenereerd uit de FONTS-bron in `style-dictionary.config.mjs` — en levert 15
  `@font-face`-regels plus de kopieën in `.storybook/public/fonts/` (beide gitignored).
  Draai `pnpm --filter rowtrack fonts:web` na een fontwijziging; `storybook` doet het zelf.
- **Reanimated vraagt zijn babel-plugin.** `react-native-worklets/plugin` staat in
  `.storybook/main.ts` onder `pluginReactOptions.babel`, dezelfde plugin als
  `babel.config.js`. Zonder hem eindigt `storybook build` op exit 0 terwijl 26 van de 197
  stories leeg renderen met één console-fout — gemeten 2026-09-07 op WheelPicker,
  GoalSheet en IdlePhase.

## Figma — Design System-bestand

Naast het schermen-bestand `T1bGrvIzSNeLyh5CbarATZ` (zie *Figma mapping*) bestaat sinds
2026-09-07 **`QkRgMc7Quqtbow71DiYa1n` — "RowTrack — Design System"**: de spiegel van
`components/` en van `tokens/tokens.json`.

**De richting is éénzijdig: code is de bron, Figma de ontvanger.** Een variant bijbouwen doe
je in de code; Figma volgt. `tokens/tokens.json` blijft het Tokens Studio sync-target en
wordt door deze keten nooit geschreven.

| | |
|---|---|
| Variabelen | `Core` 119 · `Theme` 31 · `Component` 100 — single-mode (`Value`), want de bron is dark-only en heeft geen mode-as |
| Text styles | 18, uit `Theme/type/*` |
| Effect styles | 2, uit `Theme/shadow/*` |
| Componentpagina's | 31 COMPONENT_SETs met 110 variant-nodes |
| Schermpagina's | 2 (`ActivePhase`, `IdlePhase`) met representatieve frames in plaats van een set |

**Drie eigenaardigheden, elk gemeten en niet af te leiden:**

1. `Core/fontFamily/sourceSerif` staat in de bron als `"Source Serif Pro"`, maar dat is de
   *opzoeksleutel* in de FONTS-tabel; de app rendert **Source Serif 4**. De Figma-variabele
   draagt daarom de gerenderde familie, opgelost tegen `listAvailableFontsAsync()`. Zie
   `BACKLOG.md` voor de tokenfix.
2. **Een gebonden `lineHeight` landt in Figma altijd als PIXELS** met de rauwe tokenwaarde.
   `Core/lineHeight/normal` is 125 (procent), dus een binding zet 125px op tekst van 17px —
   ook ná het expliciet zetten van `unit: 'PERCENT'`. `lineHeight` blijft daarom ongebonden.
3. `fontWeight` kan niet binden: `Core/fontWeight` mengt `"400"` en `"Italic"`, dus de
   variabelen zijn STRING terwijl Figma FLOAT eist. Het gewicht zit in `fontName.style`.

---

## Verify-pad

Wat de `verify`-skill hier kan uitvoeren. Vastgesteld 2026-08-07 door het te draaien, niet door
het af te leiden. Staat er "geen", dan is dat een gat dat gebouwd moet worden — geen vergetelheid.

| Capability | Commando / status |
|---|---|
| **Componenten vastleggen** | `pnpm --filter rowtrack build-storybook` + `pnpm --filter rowtrack render:sweep` — rendert álle 197 stories in Chromium en telt console-fouten én lege renders. Dit is het enige render-pad dat zonder simulator werkt. Een geslaagde build zegt hier niets: gemeten 2026-09-07 gaf `storybook build` exit 0 terwijl 26 stories leeg renderden. |
| **Figma ↔ code toetsen** | `pnpm --filter rowtrack figma:check` — tien assen (dekking, pagina's, variant-assen, variant-nodes, tokennamen, tokenwaarden, typografie, deep-links, hardcoded waarden, aantal ongebonden waarden). Vereist een verse `figma/manifest.json`; zie *Figma-manifest verversen* hieronder. |
| **Guard tegenproef** | `pnpm --filter rowtrack figma:check:selftest` — muteert per as een wegwerpkopie en eist dat díe as omvalt, plus twee controle-mutaties waarop hij hoort te zwijgen. |
| **Figma ↔ browser (maten)** | `pnpm --filter rowtrack parity` — legt per variant-node hoogte, breedte, horizontale padding, gap, radius, randbreedte en opacity naast elkaar. Vereist `figma/geometry.figma.json`; recept hieronder. |
| **Bouwspec verversen** | `pnpm --filter rowtrack figma:spec` — leest de variant-assen uit de gebouwde Storybook en meet elke variant in de browser. Draai dit ná elke component- of storywijziging, vóór `figma:check`. |
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

### Figma-manifest verversen

Nodig na **elke** wijziging aan het Figma-bestand. Vereist een actieve Desktop Bridge én het
**juiste bestand als actief doel** — de Bridge is multi-client, dus meerdere bestanden kunnen
tegelijk verbonden zijn. Staat "RowTrack — Design System" niet actief, dan schakel je
(`figma_list_open_files`, dan `figma_navigate`), je stopt niet. De fileKey-assert blijft nodig
náást die schakelstap: het actieve doel kan bij een reconnect stil terugwisselen.

Lees een node die in deze sessie bewerkt is **altijd** via de runtime (`figma_execute`,
`figma_capture_screenshot`). De REST-tools (`figma_take_screenshot`,
`figma_get_component_for_development`) geven de laatst opgeslagen cloud-staat en zijn na een
verse edit per definitie stale.

```js
// figma_execute — levert figma/manifest.json (schema 2)
if (figma.fileKey !== "QkRgMc7Quqtbow71DiYa1n") return { fout: "verkeerde file: " + figma.fileKey };
await figma.loadAllPagesAsync();

const collections = {};
for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
  const vars = await Promise.all(c.variableIds.map(id => figma.variables.getVariableByIdAsync(id)));
  const waarden = {};
  for (const v of vars) {
    const w = Object.values(v.valuesByMode)[0];
    // Een alias slaan we op als PAD, niet als node-id: een id verandert bij elke herbouw
    // en zou de guard elke keer rood maken op iets dat niet gewijzigd is.
    if (w && w.type === "VARIABLE_ALIAS") {
      const doel = await figma.variables.getVariableByIdAsync(w.id);
      const doelCol = await figma.variables.getVariableCollectionByIdAsync(doel.variableCollectionId);
      waarden[v.name] = { alias: doelCol.name + "/" + doel.name };
    } else waarden[v.name] = { waarde: w };
  }
  collections[c.name] = { modes: c.modes.map(m => m.name), variables: vars.map(v => v.name), waarden };
}

const pages = {};
for (const p of figma.root.children) {
  // Welke node is "primary"? Exacte naammatch op de pagina wint, dan een prefix, dan de
  // eerste component set. Zonder die volgorde kiest het recept een hulpnode en faalt de
  // [link]-as op een verschil dat er niet is.
  const k = p.children;
  const hoofd = k.find(c => c.name === p.name)
    ?? k.find(c => c.name.startsWith(p.name))
    ?? k.find(c => c.type === "COMPONENT_SET")
    ?? k.find(c => c.type === "COMPONENT") ?? null;
  pages[p.name] = {
    pageId: p.id,
    primary: hoofd ? {
      name: hoofd.name, id: hoofd.id, type: hoofd.type,
      variantProperties: hoofd.type === "COMPONENT_SET" ? hoofd.variantGroupProperties : null,
      varianten: hoofd.type === "COMPONENT_SET" ? hoofd.children.map(v => ({ name: v.name, id: v.id })) : null,
    } : null,
    extra: k.filter(c => c !== hoofd).map(c => ({ name: c.name, id: c.id, type: c.type })),
  };
}

return {
  $comment: "Neergeslagen Figma-staat. NIET met de hand bewerken — ververs via apps/rowtrack/CLAUDE.md.",
  schemaVersie: 2, fileKey: figma.fileKey, fileName: figma.root.name,
  gegenereerd: new Date().toISOString().slice(0, 10),
  collections,
  textStyles: (await figma.getLocalTextStylesAsync()).map(t => ({
    name: t.name, family: t.fontName.family, style: t.fontName.style, fontSize: t.fontSize,
    lineHeight: t.lineHeight.unit === "PIXELS" ? t.lineHeight.value : t.lineHeight.unit,
    letterSpacing: t.letterSpacing.value ?? 0 })),
  effectStyles: (await figma.getLocalEffectStylesAsync()).map(e => ({ name: e.name, lagen: e.effects.length })),
  pages,
};
```

### Figma-geometrie uitlezen (voor `parity`)

```js
// figma_execute — levert figma/geometry.figma.json
if (figma.fileKey !== "QkRgMc7Quqtbow71DiYa1n") return { fout: "verkeerde file: " + figma.fileKey };
await figma.loadAllPagesAsync();
const componenten = {};
for (const p of figma.root.children) {
  const set = p.children.find(c => c.type === "COMPONENT_SET") ?? p.children.find(c => c.type === "COMPONENT");
  if (!set) continue;
  const knopen = set.type === "COMPONENT_SET" ? set.children : [set];
  const varianten = {};
  for (const v of knopen) {
    // De gemeten node is het KIND van de wrapper-component, niet de wrapper zelf: de
    // wrapper draagt alleen de app-achtergrond zodat alpha-kleuren goed lezen.
    const n = v.children[0] ?? v;
    varianten[v.name] = {
      w: Math.round(n.width * 100) / 100, h: Math.round(n.height * 100) / 100,
      paddingLeft: n.paddingLeft ?? 0, paddingRight: n.paddingRight ?? 0,
      itemSpacing: n.itemSpacing ?? 0,
      radius: n.cornerRadius === figma.mixed ? n.topLeftRadius : (n.cornerRadius ?? 0),
      strokeWeight: n.strokeWeight === figma.mixed ? null : (n.strokeWeight ?? 0),
      opacity: n.opacity ?? 1,
      heeftVulling: Array.isArray(n.fills) && n.fills.length > 0,
      heeftRand: Array.isArray(n.strokes) && n.strokes.length > 0,
      heeftEffect: (Array.isArray(n.effects) && n.effects.length > 0) || !!n.effectStyleId,
    };
  }
  componenten[p.name] = { setId: set.id, varianten };
}
return { gegenereerd: new Date().toISOString().slice(0, 10), componenten };
```

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
