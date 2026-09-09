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
  `babel.config.js`. Zonder hem eindigt `storybook build` op exit 0 terwijl 26 van de toen 197
  stories leeg renderen met één console-fout — gemeten 2026-09-07 op WheelPicker,
  GoalSheet en IdlePhase.

## Figma — Design System-bestand

Naast het schermen-bestand `T1bGrvIzSNeLyh5CbarATZ` (zie *Figma mapping*) bestaat sinds
2026-09-07 **`QkRgMc7Quqtbow71DiYa1n` — "RowTrack — Design System"**: de spiegel van
`components/` en van `tokens/tokens.json`.

**Figma beslist, code bewaart — besluit Jeroen, 2026-09-09.** Tot die dag was de regel *code is
de bron, Figma de ontvanger*, en dat blijft waar voor wat er op schijf staat: de app bouwt uit
`components/`, en `tokens/tokens.json` blijft het Tokens Studio sync-target dat deze keten nooit
schrijft. Maar een **wijziging** wordt in Figma gemaakt, en gaat zo rond:

1. Wijzig in **de library-file** (`QkRgMc7Quqtbow71DiYa1n`), op de variant — nooit op een
   scherm-instance in *Screens v2*: die is een gegenereerde kopie en een override erop bestaat
   alleen daar.
2. Ververs het manifest en draai `figma:check`: de **bouwhash-poort** van de builder meldt welke
   nodes handwerk dragen. Dat is de wijzigingslijst, geen drift.
3. Zet die om in code met de scoped `figma-naar-code` skill (`apps/rowtrack/.claude/skills/`).
4. Herbouw met de builder — sinds 2026-09-09 een **update in place**, keys blijven — en eis
   parity én beeld op nul: dat bewijst dat de rondgang klopt. Een verschil dat blijft staan is
   een eigenschap die de keten nog niet kan dragen; de lijst daarvan staat in
   `briefings/2026-09-09-audit-figma-verschilklassen.md`.
5. Jeroen publiceert de library; de schermen volgen bij de eerstvolgende schermherbouw.

Een bewerking die stap 3 en 4 overslaat, overleeft de volgende herbouw niet — dat is nu de
tegenproef van de rondgang, geen risico.

| | |
|---|---|
| Variabelen | `Core` 119 · `Theme` 31 · `Component` 100 — single-mode (`Value`), want de bron is dark-only en heeft geen mode-as |
| Text styles | 18, uit `Theme/type/*` |
| Effect styles | 2, uit `Theme/shadow/*` |
| Componentpagina's | **21 COMPONENT_SETs met 172 variant-nodes plus 24 losse componenten = 45 pagina's** (stand 2026-09-09, geteld in `figma/manifest.json`) |
| Schermpagina's | **geen** — de schermen staan sinds 2026-09-08 niet meer in dit bestand maar als 24 frames op *Screens v2* in `T1bGrvIzSNeLyh5CbarATZ`, opgebouwd uit instances van deze library |

**Tien eigenaardigheden, elk gemeten en niet af te leiden:**

1. `Core/fontFamily/sourceSerif` staat in de bron als `"Source Serif Pro"`, maar dat is de
   *opzoeksleutel* in de FONTS-tabel; de app rendert **Source Serif 4**. De Figma-variabele
   draagt daarom de gerenderde familie, opgelost tegen `listAvailableFontsAsync()`. Zie
   `BACKLOG.md` voor de tokenfix.
2. **Een gebonden `lineHeight` of `letterSpacing` landt in Figma altijd als PIXELS** met de
   rauwe tokenwaarde — ook ná het expliciet zetten van `unit: 'PERCENT'`; de binding wint van
   de unit. `Core/lineHeight/normal` is 125 (procent), dus een binding zette 125px op tekst van
   17px. Bij `letterSpacing` was het erger én langer onzichtbaar: `Core/letterSpacing/wide` is
   20, dus `type/labelSection` kreeg **20px tracking op 13px tekst** in plaats van 20% = 2,6px.
   Alle drie de label-styles stonden zo 8 à 10 keer te ruim, en `TabLabel` werd daardoor 181px
   breed in plaats van 69. Beide velden blijven daarom **ongebonden** en dragen de waarde die
   de app rendert. De herkomst wordt door `figma:check` getoetst, niet door een binding.

   *En let op hoe dit bijna gemist werd:* mijn eerste controle plakte een letterlijke `%`
   achter de waarde (`s.letterSpacing.value + '%'`) in plaats van `s.letterSpacing.unit` te
   lezen. Het rapport zag er goed uit en zei niets. Lees de **unit**, niet je eigen opmaak.
3. `fontWeight` kan niet binden: `Core/fontWeight` mengt `"400"` en `"Italic"`, dus de
   variabelen zijn STRING terwijl Figma FLOAT eist. Het gewicht zit in `fontName.style`.
4. **Een gradient-stop bindt wél, maar niet via de helper.**
   `figma.variables.setBoundVariableForPaint` weigert een ColorStop — hij eist een Paint met
   een `type`-discriminator. De serialisatievorm die Figma zelf gebruikt werkt:
   `{ ...stop, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } } }`. Getoetst op
   drie assen: de binding staat erop, de alias-id matcht, een stop zónder alias blijft
   ongebonden, en de teruggelezen kleur is die van de variabele in plaats van de meegegeven
   waarde. 53 van de 62 stops binden; de 9 zonder zijn alpha-0-waarden zonder token.
5. **`text-transform` staat niet in de DOM-tekst.** De browser rendert "500M" terwijl
   `textContent` "500m" is. Zonder Figma's `textCase` toont het design system dus andere tekst
   dan de app — 42 nodes over 12 componenten. Gevonden door een Figma-capture naast een
   browser-screenshot te leggen; de geometrie-parity kán dit niet vinden.
6. **`figma_execute` heeft een WACHT-limiet van 30 s, geen uitvoeringslimiet.** Bij
   "Execution timed out after 30000ms" bouwt de plugin gewoon door. Stuur er dan niets
   doorheen — de plugin heeft één seriële wachtrij en een controlevraag ertussen breekt de
   lopende bouw af. Wachten en dezelfde code opnieuw sturen is de juiste zet.

7. **Emoji is geen icoonfont.** Een tekstnode met familie `-apple-system` (een emoji) hoort
   gewoon tekst te blijven: het OS vult de glyph in, ongeacht welk font eromheen staat. Alleen
   een ÉCHTE icoonfont — Ionicons, met privégebruik-glyphs — heeft zonder dat font niets te
   tonen en verdient een zichtbaar placeholder-kader. Gemeten 2026-09-08: zonder dat
   onderscheid werden de 🏅 van PrBadge en de 🏆 van MotivationalToast gestippelde kaders.
8. **`align-self: stretch` is voor tekst geen intentie, en een tekst heeft twee breedtes.**
   react-native-web zet `alignItems: stretch` op élke View, dus élk tekst-kind van een kolom
   "rekt" volgens de DOM. FILL op zo'n tekstnode pint de breedte, en Figma's engine meet
   dezelfde tekst breder dan Chromium — "1 sep 2026" (doos = run = 159,03) brak in twee regels
   over de terug-link heen, met dertien assen groen en parity op nul, want die sluit breedte
   uit. De walker meet daarom sinds 2026-09-09 óók de **run** (`Range.selectNodeContents`),
   de pruner beslist: doos > run + 4 px is een **blok** (`t.blok`, houdt zijn breedte, ook
   zonder FILL — de labelkolom van StatsTable was anders "WATT208"), de rest **hugt**. En
   `textAlign` reist mee als `t.al`; zonder dat landde elke gecentreerde blok-tekst links.
   Gemeten over 5 295 tekstnodes: 5 065 op doos = run, 213 boven de 40 px, 17 ertussen.
9. **De import-wachtrij van de plugin-runtime kan vastlopen, en daarna hangt élke import.**
   Gemeten 2026-09-09 in RowTrack - Design: `importStyleByKeyAsync` voor `type/activeProgress`
   kwam nooit terug, zonder fout of timeout, terwijl elf andere styles in 2 tot 9 ms landden;
   later die middag hing ook `Dot`, dat een uur eerder in 5 ms importeerde. De eerste hypothese
   — een verse import uit een library met ongepubliceerde wijzigingen — is dezelfde dag
   **verworpen**: na het sluiten en opnieuw starten van de Desktop Bridge-plugin in dat bestand
   importeerden dezelfde sleutels in 4 tot 410 ms, óók de 22 componenten die nog op `CHANGED`
   stonden. Het is de runtime: één hangende import houdt de wachtrij vast, eerst voor verse
   sleutels, uiteindelijk voor alles. `figma_reload_plugin` helpt niet (alleen de UI-iframe
   herlaadt, `code.js` loopt door); alleen de plugin sluiten en opnieuw starten. De builder
   importeert daarom alleen wat de spec noemt, met 4 s wachttijd per import, en een import die
   niet terugkomt is een `niet te importeren`-melding: het signaal om te herstarten, niet om
   door te bouwen. **De trigger is gemeten, twee keer op één dag:** een schermbouw die de
   30 s-wachtlimiet van `figma_execute` overschrijdt wordt afgebroken terwijl een
   `importComponentByKeyAsync` loopt, en díe halve import is de eerste hangende. Ná een
   publicatie haalt elke verse import de nieuwe versie over het netwerk (seconden per
   component), dus dan past niet eens één frame in de limiet. Daarom: eerst
   `figma/voorverwarm-imports.js` draaien tot `resterend` 0 is (elke aanroep stopt zelf op
   18 s), en `bouw-schermen.js` bouwt frame voor frame binnen een budget en geeft de rest terug
   in `resterend`; `bouwvoortgang` op de root toont welk frame er loopt.
10. **`addComponentProperty` met een bestaande naam werpt geen fout: Figma hernoemt stil naar
   `value2`, `value3`, …** en de vorige property blijft staan zonder node. Drie herbouwen
   lieten zo 73 "unused properties" achter over 22 sets, en Figma weigerde die 22 bij
   publicatie als invalid asset. Een scherm-instance zet bovendien zijn override op de éérste
   sleutel met die naam (`value#…`), dus na zo'n publicatie toont elke instance de
   library-default. De builder hergebruikt sinds die dag de property zonder suffix als
   identiteit, bindt de nieuwe nodes eraan en verwijdert wat zonder node achterblijft (luid);
   de `[eigenschappen]`-as van `figma:check` maakt het rood vóór de publicatiedialoog dat doet.

**Twee dingen over de Bridge die je pas merkt als het misgaat.**

*Het actieve doel kan na een timeout stil terugspringen.* Gemeten 2026-09-08, drie keer op rij:
na "Execution timed out after 30000ms" stond het actieve bestand op `ko2OuasYxyY2YRD69MYhWX`
(de umanex Component library) in plaats van op RowTrack. De fileKey-assert bovenaan elke
`figma_execute` is wat dat opvangt — zonder hem was er in het verkeerde bestand geschreven.
Assert op de **fileKey**, nooit op de bestandsnaam: die werd deze week hernoemd van
"RowTrack — Design System" naar "RowTrack -  Design System".

*De plugin mág localhost bereiken, maar alleen op poort 9223–9232.* Dat staat in
`~/.figma-console-mcp/plugin/manifest.json` → `networkAccess.allowedDomains`. Een lokale server
op zo'n poort maakt twee dingen mogelijk die anders honderden KB's door de tool-call slepen:
de bouwspec en de builder ophalen mét `fetch`, en het manifest terugschrijven met een `POST`
naar een save-endpoint. Buiten dat bereik krijg je `Failed to fetch` — exact dezelfde melding
als bij een server die niet draait. Ik trok daar eerst de verkeerde conclusie uit
("de sandbox kan localhost niet bereiken") omdat mijn testserver op poort 7331 stond én al
gestopt was: twee onafhankelijke oorzaken, één symptoom. Toets dus altijd eerst met `curl` dat
de server leeft én dat hij op een toegestane poort staat.

**Waarvoor dit bestand dient, en wat dat kost.** `RowTrack -  Design System`
(`QkRgMc7Quqtbow71DiYa1n`) is **gepubliceerd als library** en hangt als asset in
`RowTrack - Design` (`T1bGrvIzSNeLyh5CbarATZ`), waar Jeroen op de pagina *Screens v2* schermen
uit de componenten samenstelt. Dat maakt het bestand een **bron voor compositie**, niet enkel
een bewijsstuk. Het verschil is niet cosmetisch: de builder leegt elke pagina en maakt de nodes
opnieuw, en een nieuwe node heeft een nieuwe key — elke instance die iemand eruit plaatste raakt
dan ontkoppeld. Gemeten 2026-09-08: na de vorige herbouw stonden alle 33 componenten op
`UNPUBLISHED`, precies omdat ze vervangen waren.

**Sinds 2026-09-09 vervangt een herbouw de component niet meer, hij WERKT HEM BIJ.** Alleen de
key van de COMPONENT (en van elke VARIANT in een set) telt voor een instance; de kinderen
eronder mogen vrij vervangen worden en een instance spiegelt gewoon de nieuwe inhoud. De builder
hergebruikt daarom elke set en variant die hij bij naam terugvindt — die naam is de
variant-as-combinatie, dus een stabiele sleutel — leegt alleen hun kinderen, en maakt alleen wat
er nog niet was. Gemeten op Chip, vóór en ná in één aanroep: set-key gelijk, beide variant-keys
gelijk, status `CURRENT → CHANGED` in plaats van vervangen, en gebouwd zónder `__force`. Over
alle 45: **194 nodes hielden hun key, 0 geweigerd, 0 geforceerd.** Gevolg voor de praktijk: een
herbouw kost geen ontkoppelde instances meer en geen herpublicatie — Jeroen publiceert een
wijziging in plaats van een vervanging.

**Daarom staat er een poort vóór het legen** — die nu één vraag méér stelt. `figma/builder.js`
weigert een pagina te legen zodra een van beide waar is:

- een kind is **gepubliceerd** (`getPublishStatusAsync() !== 'UNPUBLISHED'`) **én er is geen
  bruikbare variant om te hergebruiken** — pas dan wordt de node écht vervangen en ontkoppelt
  elke instance eruit. Is hergebruik wél mogelijk, dan heeft de poort niets te beschermen;
- een kind is **met de hand gewijzigd** — de builder legt na elke bouw een `bouwhash` in
  `setPluginData`, en die wordt bij de volgende run hertoetst tegen de live node. De hash draagt
  type, naam, afgeronde maat en tekstinhoud; positie en subpixel-ruis zitten er bewust niet in,
  anders meldt élke herbouw handwerk en is de poort binnen een week uitgezet.

De enige ontsnapping is `SPEC.__force = true`, en die hoort **zichtbaar in de aanroep** te staan
— nooit stil gezet. Geforceerd overschrijven komt in `meldingen` terecht met de reden erbij.
Tegenproef: `pnpm --filter rowtrack figma:poort:selftest` — 23 gevallen, waaronder beide kanten van de hergebruik-tak (gepubliceerd mét hergebruik gaat door, zónder wordt geweigerd) en dat handwerk óók bij hergebruik weegt.

**De 30 s van `figma_execute` is een WACHTlimiet, geen uitvoerlimiet — en dat verschil heeft
twee scherpe kanten.** De plugin bouwt gewoon door nadat de tool-call is afgekapt; alleen de
returnwaarde is weg. Daaruit volgen twee regels die deze sessie allebei geld hebben gekost:

*Start nooit een tweede batch vóór de eerste klaar is.* Zonder marker weet je niet dát er nog
een builder loopt, en een tweede aanroep leegt pagina's die de eerste nog aan het vullen is.
Gemeten 2026-09-08: twee overlappende runs lieten `Chip` en `PrBadge` **leeg** achter en gaven
`KpiSingle` **twee** componenten. Het beeld daarna is niet te onderscheiden van een half
gelukte bouw.

*`fetch` sterft mee met de tool-call, `setPluginData` niet.* Een POST naar de lokale server ná
de wachtlimiet komt niet meer aan — de serverlog toont de GET's van spec en builder en daarna
niets, terwijl het document wél gebouwd is. Zet je uitkomst dus in
`figma.root.setPluginData(...)` en lees hem in een aparte, korte call terug.
`figma/bouw-batch.js` doet allebei: hij zet `bouwbezig` bij de start, `bouwresultaat` bij het
einde, en weigert te starten zolang `bouwbezig` gevuld is.

**De app-achtergrond hoort achter de component, niet erin.** De wrapper kreeg tot 2026-09-08
`Theme/bg/base` als eigen vulling zodat alpha-kleuren tegen de app-achtergrond lezen in plaats
van tegen Figma's grijze canvas. Voor een bewijsstuk klopt dat; voor een library niet, want die
vulling reist mee naar élke instance. Gemeten: een Button-instance in `RowTrack - Design` gaf
`instanceFills: 1` — een ondoorzichtig donker vlak om de knop. Dat de SET in het bronbestand een
nette achtergrond heeft helpt daar niets: **alleen de vulling van de variant zélf reist mee**.

Per geval: een variant in een set krijgt `fills = []` (de set is een frame en schildert
erachter), een losse component krijgt `fills = []` plus een gebonden `achtergrond`-rechthoek
erachter. `page.backgrounds` is géén optie — die accepteert geen variabele (*"in
set_backgrounds: page backgrounds cannot be bound to variables"*, gemeten), dus dat zou de
achtergrond een hardcoded hex maken. De `[instancevulling]`-as in `figma:check` bewaakt het.

**Een library-component importeren duurt langer dan de wachtlimiet.** Gemeten 2026-09-08, drie
keer op rij, ná een geslaagde publicatie: `figma.importComponentSetByKeyAsync(<key van Button>)`
in `RowTrack - Design` liep elke keer over de 30 s, terwijl de variabelen van diezelfde library
in datzelfde bestand binnen milliseconden opgelost worden en
`getAvailableLibraryVariableCollectionsAsync` de drie collecties gewoon teruggeeft. De import is
dus niet gebroken, hij is traag — en omdat de returnwaarde de limiet niet overleeft en de
regels ná een lange `await` niet meer draaien, is er langs deze weg geen uitkomst te krijgen.
Wie een instance-gedrag wil toetsen, doet dat met de hand in Figma; via de Bridge is het
`[NIET TE VERIFIËREN]`.

**Volgorde die niet omgekeerd mag.** Na élke Figma-bouw: **eerst het manifest verversen, dan
pas `figma:links` en `figma:check`.** Een herbouw geeft elke node een nieuwe id. Gemeten
2026-09-08: na een herbouw waren 29 van de 33 primary-ids veranderd, terwijl `figma:check`
gewoon groen stond en alle 33 deep-links naar **dode nodes** wezen. De `[link]`-as legt de
stories naast het manifest, en die waren samen verouderd — een groene check waar beide kanten
dezelfde fout dragen. De guard kan dit per constructie niet zien (CI heeft geen Figma-toegang);
de volgorde is de enige bescherming.

---

## Verify-pad

Wat de `verify`-skill hier kan uitvoeren. Vastgesteld 2026-08-07 door het te draaien, niet door
het af te leiden. Staat er "geen", dan is dat een gat dat gebouwd moet worden — geen vergetelheid.

| Capability | Commando / status |
|---|---|
| **Componenten vastleggen (build-pad)** | `pnpm --filter rowtrack build-storybook` + `pnpm --filter rowtrack render:sweep` — rendert álle stories in Chromium (257 op 2026-09-09, over 54 componenten) en telt console-fouten én lege renders. Dit is het enige render-pad dat zonder simulator werkt. Een geslaagde build zegt hier niets: gemeten 2026-09-07 gaf `storybook build` exit 0 terwijl 26 stories leeg renderden. **En de sweep zelf was tot 2026-09-09 flaky aan de staart:** vijf runs op dezelfde build gaven 16, 0, 0, 5 en 2 problemen, telkens op de LAATSTE stories (255-257, `ProfileScreen`) met 404's en een ontbrekende `#storybook-root` — terwijl diezelfde stories in isolatie drie keer foutloos renderden. Oorzaak: één Chromium-pagina voor alle 257 navigaties. De pagina wordt nu elke 50 stories ververst; daarna drie groene runs op rij. De fout gaf **valse alarmen, geen gemiste fouten** — een groene run was dus altijd betrouwbaar, een rode vroeg om een herhaling. **Dit pad meet dev niet.** Gemeten 2026-09-08: 197/197 groen terwijl `storybook dev` in dezelfde commit niet eens startte (het aantal groeit; het punt niet). Gebruik hiernaast de dev-sweep. |
| **Componenten vastleggen (dev-pad)** | `pnpm --filter rowtrack storybook` in de ene terminal, `node scripts/dev-sweep.mjs` in de andere (optioneel `--poort`, `--verbose`). Zelfde criterium als `render:sweep`, maar tegen de draaiende dev-server. Nodig omdat dev en build langs twee assen uiteenlopen: `__DEV__` staat in dev op true (bibliotheken doen dan zelfcontroles die de build nooit uitvoert) en de dependency-optimizer bestaat alleen in dev — die bundelt met rolldown zónder babel, en zonder `shimMissingExports` dat het build-pad wél zet. Beide assen zijn op 2026-09-08 opgemeten. Draai hem koud (`rm -rf apps/rowtrack/node_modules/.cache/storybook`) wanneer je een optimizer-wijziging toetst — **let op de map: de dep-cache staat onder `apps/rowtrack/node_modules`, niet in de root**; de verkeerde map wissen levert een warme cache en daarmee een onbetrouwbare meting. Het script hertest een story één keer na een reload tijdens het laden en meldt hoe vaak. |
| **Figma ↔ code toetsen** | `pnpm --filter rowtrack figma:check` — veertien assen (dekking, pagina's, variant-assen, variant-nodes, tokennamen, tokenwaarden, typografie, deep-links, hardcoded waarden, aantal ongebonden waarden, publicatievenster, herkomst van de laagnamen, instancevulling, eigenschappen — elke tekst-property heeft een node en geen stam komt dubbel voor). Vereist een verse `figma/manifest.json`; zie *Figma-manifest verversen* hieronder. |
| **Guard tegenproef** | `pnpm --filter rowtrack figma:check:selftest` — muteert per as een wegwerpkopie en eist dat díe as omvalt, plus de controle-mutaties waarop hij hoort te zwijgen. Stand 2026-09-09: 44/44. |
| **Builder-poort tegenproef** | `pnpm --filter rowtrack figma:poort:selftest` — haalt `poort` en `bouwhash` letterlijk uit `figma/builder.js` en draait ze tegen stub-nodes: weigert op publicatie en op handwerk, zwijgt op positie en subpixel-ruis. De poort draait in de plugin en is dus niet vanaf de commandoregel aan te roepen; dit is de enige manier om hem groen én rood te zien. Sinds 2026-09-09 toetst dezelfde run ook de **meldingen-basislijn** (`MELDING_SOORTEN` in `builder.js`), statisch op de brontekst en twee kanten op: elke `meldingen.push`-plek heeft een soort, elke soort dekt een plek — een nieuwe sóórt melding kan zo niet meer stil achter `slice(0, 8)` verdwijnen, en `bouwresultaat` draagt `perSoort` en `onbekend`. |
| **Figma ↔ browser (maten)** | `pnpm --filter rowtrack parity` — **recursief sinds 2026-09-08**: elke node van elke variant én van elk schermframe, op boompad. Stand 2026-09-09: 220 varianten, **3 516 nodes en 27 480 velden**, tegen 1 066 velden op ~110 wortels vóór de recursie. Per node hoogte, horizontale padding, gap, radius, randbreedte, opacity, het aantal kinderen en de aanwezigheid van vulling/rand/effect. **Breedte zit er bewust NIET in**, op geen enkele diepte: die is tekstgedreven en Figma's tekstengine meet dezelfde tekst anders dan Chromium (gemeten 2026-09-07: SectionHeader 162,78 tegen 136). Een acceptatie-item over breedte mag dus nooit op `parity exit 0` leunen. Een component of scherm dat nog niet in Figma staat is `~~ nieuw, nog niet gebouwd` — geteld, niet rood, zodat de as tijdens een sneden-batch bruikbaar blijft. **Hoogte op een tekstnode** wordt alleen vergeleken waar de builder hem zélf zette (`builder.js:148-153`, bij een browser-afbreking); waar Figma hem met `textAutoResize: WIDTH_AND_HEIGHT` bepaalt, meet vergelijken de twee tekstengines en niet de bouw — 1 212 van de 3 516 nodes op 2026-09-09 — een derde van het oppervlak; gemeten met verschillen tot 63 tegen 48 op een emoji-glyph. Vereist `figma/geometry.figma.json` op **schema 2**; schema 1 wordt geweigerd (exit 2), recept hieronder. |
| **Parity-tegenproef** | `node scripts/geometry-parity.mjs --selftest` — zes gevallen op een uit de spec gesynthetiseerde Figma-kant: een ongemuteerde **controle** die groen moet blijven, plus vijf mutaties die elk rood moeten worden op hún pad — wortel, binnennode, schermframe, een **extra wrapper** en een **verdwenen node**. Die laatste twee zijn structureel: een snede die een boom verandert verschuift geen maat, en een zelftest die alleen getallen ophoogt bewijst daar niets over. Toetst de **machinerie**, niet de builder — de builder-trouw bewijst alleen een echte Figma-lezing. `--figma=<pad>` en `--schrijf-fixture=<pad>` bestaan om de schema-poort op zijn groene kant te toetsen zonder de laatste echte lezing te overschrijven. |
| **Niet-reproduceerbare nodes** | `npm run instabiele-nodes` (in `apps/rowtrack`) — draait de walker **twee keer** en vergelijkt node voor node op boompad. Wat tussen twee runs van ónveranderde code verschilt, kan door geen enkele statische vergelijking gemeten worden; `parity` slaat die paden over. Gemeten 2026-09-09: **309 van 4 117 nodes instabiel, gesloten tot 331** — waarvan `parity` er **85** werkelijk raakt (de rest zit in subbomen die hij op een andere grond al niet vergelijkt). Twee verschillende getallen, en de tabel noemt ze allebei — de `<ActivityIndicator>` roteert (RNW `animationKeyframes` 0→360°, 0,75 s, oneindig), dus `getBoundingClientRect` geeft een as-gelijnde doos die per meetmoment anders is; de confetti in MotivationalToast is `6 + random * 8`. De sluiting gaat vanaf **`spinnerBox`** en niet vanaf `spinner`: de rotatie zit in RNW op de binnenste View, en `spinner` bleek in geen enkele run instabiel. Het script stopt met exit 2 als de sluiting geen superset van de meting is. **Deze stap SCHRIJFT** (`scripts/instabiele-nodes.mjs:44` draait zelf `figma:spec`), dus hij herschrijft `build-spec.min.json`, `laagnamen.json`, `ongebonden.json` en `story-axes.json` — en nooit byte-identiek, want de spinner draait. Gemeten 2026-09-09: één run zette er twee spinner-waarden bij in `ongebonden.json` (`radius = 3.86406`, het blauw van de `ActivityIndicator`) en `figma:check` viel om op *2 nieuwe*. Draai hem dus op een schone tree en zet de artefacten daarna terug (`git checkout origin/main -- figma/`) tenzij er écht code veranderd is; zie ook het BACKLOG-item van 2026-09-08 over dezelfde oorzaak. **Vul `figma/niet-reproduceerbaar.json` nooit met de hand aan** — een echte afwijking hoort er niet in te kunnen verdwijnen. |
| **Uitsluitings-tegenproef** | `node scripts/geometry-parity.mjs --figma=<gemuteerde kopie> --zonder-uitsluiting` — een mutatie bínnen een uitgesloten subboom hoort mét de lijst stil te blijven en zónder de lijst rood te worden. Blijft hij in beide gevallen stil, dan sluit de lijst niets uit maar meet de as daar niets, en dat ziet er in de uitvoer identiek uit. Getoetst op beide kanten, 2026-09-08. |
| **Bouwspec verversen** | `pnpm --filter rowtrack figma:spec` — leest de variant-assen uit de gebouwde Storybook en meet elke variant in de browser. Draai dit ná elke component- of storywijziging, vóór `figma:check`. Weigert te schrijven zodra één component nul varianten oplevert (exit 2, spec ongewijzigd): een mislukte meting die tóch wegschrijft, vervangt een goede spec door een lege. |
| **Figma ↔ browser (beeld)** | `pnpm --filter rowtrack beeld` — legt de gecommitte Figma-export (`figma/beelden/`, 24 frames, ~950 KB) naast een verse browser-render van dezelfde story, en diff't in Chromium's canvas (geen dependency). Dit is de as die `parity` per constructie NIET heeft: kleurwaarde, icoonvorm, `text-transform` en **breedte** — dat laatste staat op élke node buiten parity omdat twee tekstengines dezelfde tekst anders meten, en juist daar leefde de drift. Gemeten 2026-09-09: elke formulier-instance stond 390 breed met inhoud van 224, met dertien guard-assen groen. Maskeert de Ionicons-glyphs (die bestaan niet in Figma) identiek op beide beelden. **De vloer is gemeten**: `ResetPasswordScreen`, het enige scherm zonder instances, wijkt 0,02% af — dat is de renderer-ruis. Zonder `--drempel` rapporteert het script alleen; een tolerantie kies je pas als de echte verschillen weg zijn. `--schrijf` legt per frame een 3-luik in `figma/beeld-diff/` (gitignored). |
| **Beeld-tegenproef** | `pnpm --filter rowtrack beeld:selftest` — hetzelfde beeld tegen zichzelf hoort 0,00% te geven, hetzelfde beeld met een vlak van 60×60 erover ver daarboven. Geven beide dezelfde uitkomst, dan meet de opstelling niets en is dát de enige geldige conclusie. |
| **Instance-voorvlucht (welke tekst toont een instance)** | `pnpm --filter rowtrack figma:instance-tekst` (`--lijst` voor elk pad) — offline op de bouwspec, spiegelt `kiesVariant` en `toetsInstances` uit `figma/builder.js`, en telt per component wat de builder zal doen: instances · terugval (subboom nagebouwd, toont de schermdata) · tekst gelijk · slot gezet · **stil** (instance blijft staan en toont de story-data van de library). Bestaat omdat niets anders die laatste klasse ziet: de builder meldt alleen een slot dat er ís, parity ziet gelijke geometrie, `figma:check` toetst de library en niet de vulling. Stand 2026-09-09: 135 instances, 37 terugval, **23 stil** (WorkoutCard 16, Segmented 3, ActiveHeader 2, HeroPanel 2). Tweezijdige ratel op beide getallen. Tegenproef: `--selftest` — controle gelijk, een slot erbij in de library geeft één stil minder, een gebruikt slot eraf geeft er meer (een ongebruikt slot beweegt niets, gemeten op BleStatusBar). |
| **Walker-blindvlekken (wat de spec niet kan dragen)** | `node scripts/walker-blindvlekken.mjs` (`--verbose` per story, `--alle` voor alle 257) — leest de DOM van `storybook-static` buiten de walker om en telt vijf eigenschappen die hij niet meet: asymmetrische randen (`1/0/1/0` wordt in Figma een volledige doos), `<input placeholder>` zonder waarde, gescrolde containers, overloop zonder clip, geneste inline tekst — plus tekst met `textAlign` center/right als referentie voor `t.al`. Positieve controle 2026-09-09 over 42 schermstories: rand 110 · placeholder 4 · gescrold 11 · overloop 15–16 · inline 3 · center/right 32. Een meting, geen guard: elk getal boven nul is een klasse die alleen het beeld vindt, en de `Check` van de bijbehorende backlog-items. |
| **Toestel-schuld (wat Storybook niet kan tonen)** | `pnpm --filter rowtrack toestel:schuld` (`--kort` voor één regel, `--paden` voor de categorieën, `--selftest` voor de tegenproef) — telt wat er sinds de laatste `Toestel-ronde:`-trailer veranderde in code die het browser-render-pad per constructie niet toont: een `Platform.OS === 'ios'`-tak (9 bestanden; de browser kiest altijd de andere kant), `lib/ble/` (15), reanimated-animatie (2: GoalSegments en WheelPicker), en apparaat-gedrag plus native config. `react-native-safe-area-context` staat er bewust NIET bij: die zit in vrijwel elk scherm en zou 150 van de 410 commits markeren — zijn shim geeft nul insets, en dat is in de render gewoon te zien. Stand 2026-09-09: **70 van 410 commits, en geen enkele ronde ooit geregistreerd**. Registreren doe je met een trailer in de commit van de ronde, ook als je niets vond. `.githooks/pre-commit` meldt de schuld zodra een commit zo'n pad raakt. **Dit is een meting, geen poort** — en het vervangt de vraag niet of Storybook rendert wat de app rendert; die staat als rij 6 in het toestel-ronde-item van `BACKLOG.md` en is nooit getoetst. |
| **Beelden exporteren** | `figma/exporteer-beelden.js` via `figma_execute`, met `scripts/figma-serve.mjs` aan. Gebruikt `exportAsync` en niet `figma_capture_screenshot`: dat laatste legt het canvas vast, mét zoomniveau en selectie-randen. 43 ms en 24 KB voor een frame van 430×932. De bytes gaan base64 naar de lokale server — binair door een plugin-fetch is niet gegarandeerd, tekst wel. |
| **Instrument-tegenproef (dieptekap)** | `node scripts/figma-build-spec.mjs --kap=N` — verzet de kap waarop de walker de DOM-boom afsnijdt, en rapporteert per run hoeveel nodes hij weggooide én hoeveel daarvan tekst droegen. Bestaat omdat de teller ernaast tot 2026-09-09 alléén weggegooide `[data-testid]`-grenzen telde — op die diepte per constructie nul — zodat elke run `0 weggegooid` meldde terwijl er bij kap 8 **3 018 nodes** verdwenen, 2 018 met tekst. Gemeten over 257 stories: 8 -> 3 018, 9 -> 1 998, 10 -> 0, 12 -> 0; de kap staat op 12. **Let op waar je meet:** een `--kap=N`-run SCHRIJFT `figma/build-spec.json`, dus draai er `figma:spec` achteraan vóór je iets anders meet — anders draait de volgende meting op de invoer van je vorige meting (gemeten, 2026-09-09). |
| **Instrument-tegenproef (laagnamen)** | `node scripts/figma-build-spec.mjs --rnw-keys-uit` — zet de StyleSheet-sleutelkaart uit via `?rnwKeysUit=1`. Hoort **exit 2** te geven met "sleutelkaart uitgeschakeld" en de spec ongemoeid te laten. Zonder deze vlag is "elke node heet `wrapper`" niet te onderscheiden van "het instrument staat uit" — beide geven een gevulde spec zonder foutmelding. |
| **Beeld van één story** | `pnpm --filter rowtrack render:shot <story-id> [<story-id>…]` — schrijft per story een PNG uit `storybook-static`, voor de beeldvergelijking naast een Figma-capture. Vereist een verse `build-storybook`. Dit is het pad dat `figma_capture_screenshot` aan de codekant spiegelt; de geometrie-as (`parity`) ziet géén kleur, icoonvorm of `text-transform`, dus voor die drie is dit het enige instrument. |
| **Render vastleggen** | `xcrun simctl io booted screenshot <pad>.png` — werkt. Nooit een UDID hardcoden, die verandert; `booted` is stabiel. Op het fysieke toestel: geen automatisch pad, screenshot met de hand. |
| **Flow aandrijven** | **Maestro 2.8.0** (besluit Jeroen, 2026-08-08). Draaien: `JAVA_HOME=$(brew --prefix openjdk)/libexec/openjdk.jdk/Contents/Home maestro test apps/rowtrack/.maestro/smoke.yaml`. `JAVA_HOME` is niet optioneel — Homebrew's openjdk is keg-only en staat niet vanzelf op `PATH`. Installeren met **`brew install mobile-dev-inc/tap/maestro`**, nooit `brew install maestro`: dat is een gelijknamige cask van runmaestro.ai, een heel ander product. Gemeten 2026-08-08 op simulator `iPhone 17` / iOS 26.5: `smoke.yaml` slaagt (launch + twee asserts, exit 0). Drie valkuilen die hij onderweg blootlegde, zie hieronder. |
| **State forceren** | `app/dev-active.tsx` forceert de active-workout fase. Verder: `supabase/seed/test-account.sql` in de SQL Editor zet `rowtrack-test@umanex.be` terug op een vaste vertreksituatie — `health_consent = null`, lege lichaamsvelden, 4 ritten met bewust verschillende `samples`-vormen. Idempotent, dus ook de reset. |
| **Invariant draaien** | `pnpm --filter rowtrack test` (of `npm run test` in `apps/rowtrack`) draait **alle** suites: `node --test "lib/**/*.test.ts"`. Stand 2026-09-08: **57 tests over 6 suites** (`authClockSkew`, `ble/adapterReady`, `ble/hrLink`, `ble/rowerCandidate`, `ble/scan-lock`, `personalRecords`), allemaal groen. Node 24 draait TypeScript zonder transpiler en heeft `node:test`/`node:assert` ingebouwd, dus dit kost geen dependency. Werkt op modules zonder path-alias of RN-import (`bestDistanceTime.ts`, `calories.ts`, `smoothing.ts`, `period.ts`, `personalRecords.ts`, `ble/scan-lock.ts`, `ble/hrLink.ts`, `ble/rowerCandidate.ts`). Een module die `@/…` importeert lost Node niet op. **Let op:** `node --test lib/` faalt — de runner ziet de map als testbestand (nagemeten 2026-09-08: exit 1). De suites draaien **wél** in CI, sinds 2026-08-10 (`9876980`) als stap *Guard — invarianten (node:test)* in `.github/workflows/ci.yml:79`; die verzamelt ze met `git ls-files '*.test.ts'` en faalt hard op een lege lijst, dus een nieuw suite-bestand pikt hij vanzelf op. |
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
// figma_execute — levert figma/manifest.json (schema 3)
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
      // publishStatus en bouwhash voeden de [publicatie]-as. `bouwhash` schrijft de builder
      // zelf; staat hij er niet op een gepubliceerde node, dan is die node niet door de
      // builder gemaakt en vervangt een herbouw werk van onbekende herkomst.
      publishStatus: typeof hoofd.getPublishStatusAsync === "function" ? await hoofd.getPublishStatusAsync() : null,
      bouwhash: hoofd.getPluginData ? (hoofd.getPluginData("bouwhash") || null) : null,
      // Slots. Een set zonder component properties buiten zijn variant-assen is een
      // transcriptie, geen bruikbaar component.
      componentProperties: hoofd.componentPropertyDefinitions ? Object.keys(hoofd.componentPropertyDefinitions) : null,
      // Voeding voor de [instancevulling]-as. Een eigen vulling op een VARIANT of op een losse
      // COMPONENT reist mee naar elke instance; op de SET niet.
      eigenVulling: Array.isArray(hoofd.fills) ? hoofd.fills.length : 0,
      variantenMetVulling: hoofd.type === "COMPONENT_SET"
        ? hoofd.children.filter(v => Array.isArray(v.fills) && v.fills.length).length : null,
      // Voeding voor de [eigenschappen]-as: per property het aantal nodes dat ernaar wijst.
      // Een TEXT-property zonder node is voor Figma een "unused property" en maakt de
      // component bij publicatie een invalid asset (gemeten 2026-09-09: 73 over 22 sets).
      eigenschappen: (() => {
        const e = {};
        for (const [k, d] of Object.entries(hoofd.componentPropertyDefinitions ?? {})) e[k] = { type: d.type, refs: 0 };
        for (const n of hoofd.findAll(x => x.componentPropertyReferences))
          for (const id of Object.values(n.componentPropertyReferences)) if (id in e) e[id].refs++;
        return e;
      })(),
      variantProperties: hoofd.type === "COMPONENT_SET" ? hoofd.variantGroupProperties : null,
      varianten: hoofd.type === "COMPONENT_SET" ? hoofd.children.map(v => ({ name: v.name, id: v.id })) : null,
    } : null,
    extra: k.filter(c => c !== hoofd).map(c => ({ name: c.name, id: c.id, type: c.type })),
  };
}

return {
  $comment: "Neergeslagen Figma-staat. NIET met de hand bewerken — ververs via apps/rowtrack/CLAUDE.md.",
  schemaVersie: 3, fileKey: figma.fileKey, fileName: figma.root.name,
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

### Componentkeys uitlezen (voor de schermen-export)

`figma/library-component-keys.json`. Nodig omdat een instance in een **ander** bestand een
`key` vraagt (`importComponentByKeyAsync`), en die lukt alleen bij een **gepubliceerde**
component: een ongepubliceerde key geeft *"Could not find a published component with the key"*
(gemeten 2026-09-09). De key overleeft de publicatie ongewijzigd, dus dit bestand hoeft alleen
ververst te worden na een **herbouw** — die vervangt de node en geeft hem een nieuwe key.

```js
// figma_execute in RowTrack -  Design System — levert figma/library-component-keys.json
if (figma.fileKey !== "QkRgMc7Quqtbow71DiYa1n") return { fout: "verkeerde file: " + figma.fileKey };
await figma.loadAllPagesAsync();
const componenten = {}; let gepubliceerd = 0;
for (const p of figma.root.children) {
  const k = p.children;
  const hoofd = k.find(c => c.name === p.name) ?? k.find(c => c.name.startsWith(p.name))
    ?? k.find(c => c.type === "COMPONENT_SET") ?? k.find(c => c.type === "COMPONENT");
  if (!hoofd || (hoofd.type !== "COMPONENT" && hoofd.type !== "COMPONENT_SET")) continue;
  const status = await hoofd.getPublishStatusAsync();
  if (status !== "UNPUBLISHED") gepubliceerd++;
  componenten[p.name] = { type: hoofd.type, key: hoofd.key, status,
    // Per variant een eigen key: de builder kiest er één op `data-variant`.
    varianten: hoofd.type === "COMPONENT_SET"
      ? Object.fromEntries(hoofd.children.map(v => [v.name, v.key])) : null,
    slots: hoofd.componentPropertyDefinitions ? Object.keys(hoofd.componentPropertyDefinitions) : [] };
}
return await (await fetch("http://localhost:9229/library-component-keys.json", { method: "POST",
  body: JSON.stringify({ fileKey: figma.fileKey, fileName: figma.root.name,
    gegenereerd: new Date().toISOString().slice(0, 10),
    gepubliceerd, totaal: Object.keys(componenten).length, componenten }, null, 2) })).ok;
```

### Figma-geometrie uitlezen (voor `parity`)

Recursief sinds 2026-09-08 (**schema 2**). De vorige versie las alleen de wortelnode per
variant en sloeg de schermen over; `geometry-parity.mjs` weigert een schema-1-bestand nu met
exit 2 in plaats van er stil 95% van de nodes mee te missen.

Compacte codering, want de leesbare objectvorm liep tegen de payload-grens van de Bridge:
een node is een **array**, `velden` in het bestand beschrijft de posities, en index 8 draagt
de kinderen als die er zijn. 1 896 nodes passen zo in ~48 KB. De drie syntheseregels van de
builder (opgevouwen achtergrondkind, gesynthetiseerd `label`-kind, icoon-placeholder) zitten
**niet** in dit recept maar in `kinderparen()` in het parity-script — één plek, met een
zelftest eromheen.

```js
// figma_execute — levert figma/geometry.figma.json (schema 2)
if (figma.fileKey !== "QkRgMc7Quqtbow71DiYa1n") return { fout: "verkeerde file: " + figma.fileKey };
await figma.loadAllPagesAsync();

const VULLING = 1, RAND = 2, EFFECT = 4;
function lees(n) {
  const vlaggen = (Array.isArray(n.fills) && n.fills.length > 0 ? VULLING : 0)
    | (Array.isArray(n.strokes) && n.strokes.length > 0 ? RAND : 0)
    | (((Array.isArray(n.effects) && n.effects.length > 0) || n.effectStyleId) ? EFFECT : 0);
  const uit = [
    Math.round(n.height * 100) / 100,
    n.paddingLeft ?? 0, n.paddingRight ?? 0, n.itemSpacing ?? 0,
    n.cornerRadius === figma.mixed ? (n.topLeftRadius ?? 0) : (n.cornerRadius ?? 0),
    n.strokeWeight === figma.mixed ? null : (n.strokeWeight ?? 0),
    n.opacity ?? 1,
    vlaggen,
  ];
  if ("children" in n && n.children.length) uit.push(n.children.map(lees));
  return uit;
}

const paginas = {};
for (const p of figma.root.children) {
  const set = p.children.find(c => c.type === "COMPONENT_SET") ?? p.children.find(c => c.type === "COMPONENT");
  if (!set) continue;   // slaat o.a. de `achtergrond`-rechthoek op de pagina over
  const knopen = set.type === "COMPONENT_SET" ? set.children : [set];
  const varianten = {};
  // De wrapper-component draagt alleen de app-achtergrond; gemeten worden zijn KINDEREN —
  // [boom, ...overlays], in die volgorde, precies zoals figma/builder.js ze aanhangt.
  for (const v of knopen) varianten[v.name] = v.children.map(lees);
  paginas[p.name] = { setId: set.id, varianten };
}
return {
  schema: 2,
  gegenereerd: new Date().toISOString().slice(0, 10),
  velden: ["h", "paddingLeft", "paddingRight", "itemSpacing", "radius", "strokeWeight", "opacity", "vlaggen"],
  paginas,
};
```

### Schermgeometrie uitlezen (de schermen staan in een ánder bestand)

Sinds de export van 2026-09-09 staan de schermen als FRAMEs op *Screens v2* in **RowTrack -
Design** (T1bGrvIzSNeLyh5CbarATZ), opgebouwd uit library-instances. `parity` voegt
`figma/geometry.schermen.json` samen met `figma/geometry.figma.json`; ontbreekt het bestand,
dan blijven de schermen `~~ nieuw, nog niet gebouwd` in plaats van stil ongemeten.

**Twee niveaus ontwikkelen, niet één.** Een instance is de WRAPPER van de library-component
(`COMPONENT(wrapper) > node`), en een component met een story-decorator heeft er nog één
tussen (`wrapper > decoratorView > node`). De bouwspec kent geen van beide. Hoe diep de
componentgrens in zijn eigen gemeten boom zit, staat in de spec zelf — de node met
`component === <naam>` — en dat getal plus één is het aantal stappen. Gemeten 2026-09-09:
zonder deze correctie 426 verschillen, met één vast niveau nog altijd 426, met de gemeten
diepte 42.

```js
// figma_execute in RowTrack - Design — levert figma/geometry.schermen.json
if (figma.fileKey !== "T1bGrvIzSNeLyh5CbarATZ") return { fout: "verkeerde file: " + figma.fileKey };
await figma.loadAllPagesAsync();
const min = await (await fetch("http://localhost:9229/build-spec.min.json")).json();
const diepte = {};
for (const [naam, d] of Object.entries(min.componenten)) {
  const zoek = (n, k) => { if (n.component === naam) return k;
    for (const c of n.k ?? []) { const r = zoek(c, k + 1); if (r !== null) return r; } return null; };
  const v = zoek(d.varianten[0].boom, 0);
  if (v !== null) diepte[naam] = v;
}
const p = figma.root.children.find(x => x.name === "Screens v2");
const VULLING = 1, RAND = 2, EFFECT = 4;
async function lees(n) {
  if (n.type === "INSTANCE") {
    const m = await n.getMainComponentAsync();
    const comp = m?.parent?.type === "COMPONENT_SET" ? m.parent.name : n.name;
    let x = n;
    for (let i = 0; i < 1 + (diepte[comp] ?? 0) && "children" in x && x.children.length; i++) x = x.children[0];
    return lees(x);
  }
  const vlaggen = (Array.isArray(n.fills) && n.fills.length > 0 ? VULLING : 0)
    | (Array.isArray(n.strokes) && n.strokes.length > 0 ? RAND : 0)
    | (((Array.isArray(n.effects) && n.effects.length > 0) || n.effectStyleId) ? EFFECT : 0);
  const uit = [Math.round(n.height * 100) / 100, n.paddingLeft ?? 0, n.paddingRight ?? 0, n.itemSpacing ?? 0,
    n.cornerRadius === figma.mixed ? (n.topLeftRadius ?? 0) : (n.cornerRadius ?? 0),
    n.strokeWeight === figma.mixed ? null : (n.strokeWeight ?? 0), n.opacity ?? 1, vlaggen];
  if ("children" in n && n.children.length) { const k = []; for (const c of n.children) k.push(await lees(c)); uit.push(k); }
  return uit;
}
const paginas = {};
for (const f of p.children) {
  const comp = f.getPluginData("scherm"), naam = f.getPluginData("frame");
  if (!comp || !naam) continue;
  const k = []; for (const c of f.children) k.push(await lees(c));
  (paginas[comp] ??= { setId: p.id, varianten: {} }).varianten[naam] = k;
}
return await (await fetch("http://localhost:9229/geometry.schermen.json", { method: "POST", body: JSON.stringify({
  schema: 2, bron: figma.fileKey, pagina: p.name, gegenereerd: new Date().toISOString().slice(0, 10),
  velden: ["h", "paddingLeft", "paddingRight", "itemSpacing", "radius", "strokeWeight", "opacity", "vlaggen"],
  paginas })})).ok;
```

### Schermen bouwen (instances uit de library)

`figma/bouw-schermen.js`, gedraaid in **RowTrack - Design**, met `scripts/figma-serve.mjs` aan.

**Eén frame per aanroep, en AFWACHTEN.** Een netwerk-import overleeft het venster van
`figma_execute` niet: fire-and-forget bleef hangen op de eerste `importComponentByKeyAsync`,
dezelfde aanroep awaited duurde 39 ms (gemeten 2026-09-09). Een afgebroken bouw laat bovendien
de importwachtrij van de plugin wedged achter — daarna hangt élke verse import tot de plugin
volledig herstart is, en een UI-herlaad helpt niet omdat `code.js` doorloopt.

```js
// 1. Voorverwarmen — herhalen tot resterend === 0 (elke aanroep stopt zelf op 18 s).
const bron0 = await (await fetch("http://localhost:9229/voorverwarm-imports.js")).text();
const F = Object.getPrototypeOf(async function () {}).constructor;
return await (new F("BUDGET", "figma", bron0))(18000, figma);
```

```js
// 2. Bouwen — een scherm per aanroep; staat er iets in `resterend`, roep dan opnieuw aan.
const SCHERMEN = ["ActivePhase"], FRAMES = [], STAMP = "…", BUDGET = 18000;
const bron = await (await fetch("http://localhost:9229/bouw-schermen.js")).text();
const F = Object.getPrototypeOf(async function () {}).constructor;
return await (new F("SCHERMEN", "FRAMES", "STAMP", "BUDGET", "figma", bron))(SCHERMEN, FRAMES, STAMP, BUDGET, figma);
```

Sinds 2026-09-09 bouwt `bouw-schermen.js` frame voor frame binnen een tijdbudget, want een
aanroep die de wachtlimiet overschrijdt wordt midden in een import afgebroken en zet de
import-wachtrij van de plugin vast (eigenaardigheid 9). Poll de voortgang met
`figma.root.getPluginData('bouwvoortgang')`; een lege string mét een lege `bouwbezig` is klaar.

Instances vragen een **gepubliceerde** library: een ongepubliceerde key geeft *"Could not find
a published component with the key"*. De key overleeft de publicatie ongewijzigd (gemeten).

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
