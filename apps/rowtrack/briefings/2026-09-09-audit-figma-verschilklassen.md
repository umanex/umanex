# Waarom code → Figma fout ging — de 24 schermframes per oorzaak

| | |
|---|---|
| **Datum** | 2026-09-09 |
| **Type** | audit |
| **Project** | rowtrack |
| **Klant** | umanex |
| **Status** | gebouwd |

Geen TC-EBC: dit is onderzoek naar de keten, geen design-briefing. Dezelfde vorm als
`2026-07-04-audit-design-vs-code.md` — een beslisdocument met tellingen.

---

## De vraag, en de keten waar hij over gaat

Op 2026-09-09 wijken 22 van de 24 schermframes in `RowTrack - Design` zichtbaar af van de
browser. De vraag van deze ronde: **waarom**, per oorzaak en niet per symptoom, en waar de les
dan hoort — in de skill, in een script, of in de builder.

De keten heeft vijf schakels, en Storybook is de eerste, niet een bijzaak:

1. **Storybook** rendert elke component en elk scherm in Chromium via react-native-web.
   257 stories over 54 componenten. Dit is de enige render zonder simulator, en de keten
   neemt hem als waarheid.
2. **De walker** (`scripts/figma-build-spec.mjs`) meet elke DOM-node: maat, spacing, kleur,
   font, tokenbinding. Dat wordt de bouwspec (`figma/build-spec.json`, 61 MB; de pruner maakt
   er `build-spec.min.json` van).
3. **De builder** (`figma/builder.js`) draait ín Figma via de Console MCP en maakt per gemeten
   node een Figma-node, gebonden aan variabelen. Per component een pagina in de library; de
   24 schermframes in het tweede bestand als instances uit die library.
4. **De guards**: `figma:check` (dertien assen), `parity` (geometrie, 27 480 velden) en sinds
   2026-09-09 `beeld` (pixelvergelijking browser tegen Figma-export).
5. **Figma zelf**, met een tekstengine die dezelfde tekst breder meet dan Chromium.

Een verschil in Figma kan bij elk van die schakels ontstaan, en de fix en de les verschillen
per schakel. Daarom is de eerste stap toewijzen, niet fixen.

| Schakel | Wat er misgaat | Wie het nu kan zien |
|---|---|---|
| Storybook tegenover de app | react-native-web rendert anders dan het toestel | niemand — `[NIET TE VERIFIËREN]` deze ronde (geen simulator, geen Metro); rij 6 van het toestel-ronde-item in `BACKLOG.md` |
| walker tegenover de DOM | een eigenschap wordt niet gemeten | `scripts/walker-blindvlekken.mjs` (nieuw) |
| builder tegenover de spec | uitkomst getranscribeerd in plaats van intentie; slots niet gezet; instance valt terug | `parity` voor maten, `beeld` voor breedte en tekst, `scripts/instance-tekst.mjs` (nieuw) voor de vulling |
| Figma tegenover de builder | tekstengine meet anders | alleen `beeld` |

## Methode

- **Corpus:** de 24 drieluiken in `figma/beeld-diff/` (browser · Figma · verschil), gegenereerd
  door `pnpm --filter rowtrack beeld --schrijf` op de export van 2026-09-09 14:40.
- **Classificatie op oorzaak.** Elk zichtbaar verschil kreeg een klasse die naar de oorzaak
  heet. "Tekst afgekapt" is een symptoom; "de doos van de tekst werd getranscribeerd, niet zijn
  intentie" is een klasse.
- **Tellen, niet turven.** Elke klasse is nageteld op de bouwspec (`node` over
  `build-spec(.min).json`) of op de DOM van `storybook-static` (42 schermstories), buiten de
  walker om — een positieve controle, want de walker is het instrument onder verdenking.
- **Mechanismeregel.** Per klasse de regel in walker, pruner of builder waar de gemeten waarde
  de bedoeling vervangt.
- **Tegenproef per klasse:** welke bestaande as had het kunnen zien. "Geen" is een bevinding
  over de instrumenten.

## De klassentabel

| # | Klasse (oorzaak) | Mechanismeregel | Wie het zag | Gemeten (24 frames tenzij anders) |
|---|---|---|---|---|
| A | **Tekst krijgt de breedte van zijn ouder (FILL) in plaats van zijn inhoud (HUG).** `rekt` las `align-self: stretch` als intentie, maar dat is de RNW-default van élk View-kind. FILL op een tekstnode pint de breedte; Figma meet dezelfde tekst breder dan Chromium → "1 sep 2026" (doos = run = 159,03) brak in twee regels over OVERZICHT; "Wachtwoord vergeten?" brak af. Spiegelbeeld: een **blok** zonder stretch (de labelkolom van StatsTable, 165 breed met een run van 40) werd gehugd → "WATT208". | walker `rekt` (`figma-build-spec.mjs`), builder `zetRek` en `textAutoResize` | alleen beeld — parity sluit breedte uit | 124 van 625 tekstnodes kregen FILL; over de hele spec 5 295 tekstnodes: 5 065 op doos = run, 213 boven de 40 px, 17 ertussen |
| B | **Tekst-uitlijning reisde niet mee.** Walker mat `textAlign`, pruner liet hem vallen, builder zette nooit `textAlignHorizontal`. Gecentreerde blok-tekst landde links ("RowTrack", "Account aanmaken", "RowTrack v1.0.0"; "18:44" rechts-uitgelijnd). Daarbovenop: `layoutAlign = MAX` op een kind wordt door Figma **stil genegeerd** (leest `INHERIT` terug), dus `align-self: flex-end` landde links. | pruner `t` (`figma-build-prune.mjs`), builder tekst-tak en `zetRek` | alleen beeld | 23 tekstnodes center/right (DOM-controle: 32 over 42 stories); 15 ervan óók FILL |
| C | **Slot-detectie op gelijkheid met story-args laat afgeleide tekst stil op library-data.** `markeerSlots` markeert een tekstnode alleen als hij letterlijk gelijk is aan een string-arg. "27:00 min", "20 AUG 2026", "Week Maand Jaar" zijn dat nooit → de instance toont de story-data van de library. De builder meldt het **niet** (`slot-niet-gezet` vuurt alleen als er een slot ís). | `figma-build-spec.mjs` `markeerSlots`; `figma/builder.js` `maakInstance` | niemand — parity groen, `figma:check` groen | 135 instances; **37 vallen terug**, **23 tekstnodes stil** (WorkoutCard 16, Segmented 3, ActiveHeader 2, HeroPanel 2). Een eerste telling zonder terugval-toets zei 119: daar zaten de 96 WheelPicker-items in, en die instance valt terug |
| D | **Library-variant heeft een ander aantal kinderen → subboom nagebouwd.** Bekend (BACKLOG 2026-09-09). Paradox: de nagebouwde subboom toont de juiste data (History rij 1, WorkoutDetail Zonder Hartslag-tabs), de instance niet (C). Stories zijn het variantmodel: wat geen story toont, kent de library niet. | `figma/builder.js` `toetsInstances` | builder meldt het | 37 offline (32 in de herbouw van vandaag; de builder telt op diepte) |
| E | **Geneste inline Text wordt frame plus los label.** "Nog geen account? *Registreer*": eigen tekst wordt een `label`-kind, `layoutMode NONE` → overlap. Figma kent geen inline-stroom. | `figma/builder.js:575` | alleen beeld | 3 nodes (Login, Register, Forgot) |
| F | **Scroll-semantiek niet getranscribeerd.** Geen `scrollTop`, `clipsContent = false` → WheelPicker vanaf item 1, lijst loopt onder de knop door. | walker meet geen `scrollTop`; builder `clipsContent` | alleen beeld | 11 gescrolde containers, 15–16 overlopend zonder clip (DOM) |
| G | **Input-placeholder is een attribuut, geen tekstnode.** | walker `eigenTekst` (`nodeType === 3`) | alleen beeld | 4 inputs |
| J | **Per-zijde randen samengevouwen.** Walker leest alleen `borderTopWidth`; builder zet één `strokeWeight`. `1/0/1/0` wordt een doos, `0/0/1/0` verdwijnt. | walker `borderWidth`; builder strokes | alleen beeld | 110 elementen (DOM, 42 stories) |
| I | **Text-style-keuze negeert tracking.** Enige kandidaat op familie+grootte wint; "RESTERENDE TIJD" (3,2 px) krijgt `segmentActive` (−0,24 px). | `figma-build-spec.mjs` `styleRef` | niemand — de typografie-as toetst de style, niet de meting | 24 van 324 tekstnodes met style |
| H | Iconen zonder font → placeholder. Bekend (BACKLOG 2026-09-07); de beeld-as maskeert ze. | — | — | 275 glyphs |
| K | Renderer-ruis (hinting). Vloer 0,02 %, gemeten op ResetPasswordScreen. Geen defect. | — | — | — |

Twee dingen die pas tijdens het bouwen bovenkwamen en die geen klasse van het beeld zijn maar
van de keten zelf, allebei in `CLAUDE.md` als eigenaardigheid 9 en in de skill:

- **De import-wachtrij van de plugin-runtime kan vastlopen.** Direct na de library-herbouw
  hing `importStyleByKeyAsync` voor drie styles; de eerste hypothese (een verse import uit een
  library met ongepubliceerde wijzigingen) is dezelfde dag verworpen: na een volledige herstart
  van de plugin importeerde alles in 4 tot 410 ms, óók de 22 nog ongepubliceerde componenten.
  De builder importeert nu alleen wat de spec noemt, met 4 s wachttijd, en een hangende import
  is een melding: het signaal om de plugin te herstarten.
- **`addComponentProperty` met een bestaande naam hernoemt stil** (`value2`, `value3`) en laat
  de vorige property zonder node achter; Figma weigert de component dan bij publicatie als
  invalid asset — 22 van de 45. De builder hergebruikt nu de property zonder suffix, verwijdert
  de wezen, en `figma:check` heeft er een as voor (`[eigenschappen]`).
- **`layoutAlign = MIN | CENTER | MAX` is een stille no-op** (de derde, naast `resize()` op een
  instance-kind en `layoutMode` op een instance-wortel). De builder leest nu terug en vervangt
  hem door FILL op de kruis-as plus uitlijning op het kind zelf.

## Frame × klasse

`✓` = zichtbaar in het drieluik van 14:40. Vet = na de fix van vandaag weg op dit frame.

| Frame | A | B | C | D | E | F | G | J | I | H | grof vóór → ná |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WorkoutDetail / Playground | **✓** | | ✓ tabs | | | | | ✓ | | ✓ | 6,62 → 6,31 |
| WorkoutDetail / Zonder Hartslag | **✓** | | | ✓ tabs | | | | ✓ | | ✓ | 7,27 → 6,97 |
| WorkoutDetail / Niet Gevonden | | | | | | | | | | ✓ | 0,34 → 0,36 |
| History / Playground | | | ✓ rij 2–5 | ✓ rij 1, tabs, KPI | | | | ✓ | | ✓ | 6,79 → 6,62 |
| History / Een Record | | | | ✓ | | | | ✓ | | ✓ | 4,84 → 4,67 |
| History / Leeg | | | | ✓ | | | | ✓ | | ✓ | 4,16 → 3,97 |
| Login | **✓** | **✓** | | | ✓ | | ✓ | | | ✓ | 3,29 → 3,01 |
| Register | | **✓** | | | ✓ | | ✓ | | | ✓ | 4,69 → 4,53 |
| Forgot | | **✓** | | | ✓ | | ✓ | | | | 4,90 → 4,75 |
| ResetPassword ×2 | | | | | | | | | | | 0,02 → 0,02 |
| Profile ×3 | | **✓** | | | | | | | | ✓ | 1,94 → 1,79 |
| ActivePhase / Playground, Zonder Hartslagband | | ✓ 18:44 ⁱ | | ✓ Stop-knop | | | | | ✓ | ✓ | 3,04 / 2,96 → gelijk ⁱ |
| ActivePhase / Doel Afstand | | ✓ ⁱ | ✓ 2 km, 1.450 m ⁱ | ✓ | | | | | ✓ | ✓ | 2,91 → gelijk ⁱ |
| ActivePhase / Doel Bereikt | ✓ toast ⁱ | ✓ ⁱ | | ✓ | | | | | ✓ | ✓ | 5,76 → 5,72 |
| ActivePhase / Samenvatting | ✓ tabel ⁱ | | ✓ 5,0 · HALEN ⁱ | | | | | | | ✓ | 2,00 → gelijk ⁱ |
| ActivePhase / Landscape | | ✓ ⁱ | | ✓ | | | | | ✓ | ✓ | 3,36 → gelijk ⁱ |
| IdlePhase ×4 | ✓ segment-rij ⁱ | | ✓ Toestel Keuze | ✓ wheel | | ✓ | | ✓ | | ✓ | 2,2–2,3 → gelijk (Toestel Keuze 2,23 → 1,89) |

ⁱ = de tekst zit in een library-instance: het scherm toont de **gepubliceerde** library, dus dit
verandert pas na Jeroens publicatie en een tweede schermherbouw (HANDOFF 2026-09-09).

Totaal over 24 frames vóór de publicatie: **12 beter, 0 slechter, 12 gelijk**; som grof 77,82 →
75,28, som zichtbaar 172,9 → 168,1. Ná de publicatie en de tweede schermherbouw (de instance-
frames volgen dan de nieuwe library): **16 beter, 7 gelijk, 1 slechter** (Doel Bereikt, confetti);
som grof 74,10. De winst is klein in procenten omdat de resterende klassen (C, D, J,
H en de 30 px-verschuiving van de Segmented-instance in WorkoutDetail, zie BACKLOG) het
grootste oppervlak dragen; de fix raakt precies de vier dingen die hij beloofde: titel op één
regel, terug-link terug, tabelkolommen gescheiden, uitlijning mee.

## Wat er vandaag gebouwd is

**De fix voor A en B** — tekst hugt tenzij bewezen blok, en de uitlijning reist mee.

- Walker: meet per tekst de **run** (`Range.selectNodeContents`) naast de doos →
  `tekst.inhoudBreedte`.
- Pruner: `rektVoorTekst` — `H` blijft alleen wanneer doos > run + 4 px (drempel gemeten op de
  verdeling); `t.blok` voor zo'n blok; `t.al` voor `CENTER | RIGHT | JUSTIFIED`.
- Builder: `textAlignHorizontal` altijd; een blok houdt zijn breedte (`HEIGHT` + vaste maat),
  ook zonder FILL; `layoutAlign` teruggelezen en bij een no-op vervangen; imports alleen op wat
  de spec noemt, met wachttijd; `meldingen` gedeclareerd vóór de eerste melding.
- Tellingen na de fix op de 24 frames: 625 tekstnodes, 118 met FILL (was 124; de zes die vielen
  zijn de afbreekgevallen), 130 blokken waarvan 12 zonder FILL, 495 hug, 23 met uitlijning.

**Twee instrumenten** — allebei met een rij in het Verify-pad van `CLAUDE.md`.

- `scripts/instance-tekst.mjs` (`pnpm --filter rowtrack figma:instance-tekst`): de voorvlucht.
  Spiegelt `kiesVariant` en `toetsInstances` offline en telt per component instances ·
  terugval · gelijk · slot · **stil**. Tweezijdige ratel op 23 stil / 37 terugval. Zelftest op
  drie kanten (controle gelijk; slot erbij → één minder; een *gebruikt* slot eraf → meer — een
  ongebruikt slot beweegt niets, gemeten op BleStatusBar).
- `scripts/walker-blindvlekken.mjs`: de positieve controle op de DOM van `storybook-static`
  voor E, F, G, J en de uitlijning. Rand 110 · placeholder 4 · gescrold 11 · overloop 15–16 ·
  inline 3 · center/right 32.

**Bewijs in Figma.** Library: 45 componenten bijgewerkt in place (196 nodes hielden hun key,
0 geweigerd, 0 geforceerd, geen onbekende meldingsoort). Manifest vers, `figma:check` 13/13,
`parity` 0 verschillen over 3 516 nodes, `figma:links` 0 bijgewerkt. Schermen: 24 frames
herbouwd (1,4 tot 5,5 s per scherm), schermgeometrie vers, `parity` 0, 24 beelden geëxporteerd,
`beeld` vóór/ná hierboven.

## Acceptatie

- [x] Elk zichtbaar verschil in de 24 drieluiken heeft een klasse die naar de oorzaak heet, met
      mechanismeregel en tegenproef — bewijs: de klassentabel, elk met een telling op spec of DOM
- [x] Titel "1 sep 2026" op één regel, terug-link zichtbaar — bewijs:
      `figma/beeld-diff/WorkoutDetailScreen__Playground.3luik.png` na de herbouw; grof 6,62 → 6,31
- [x] Tabelkolommen gescheiden ("WATT 208 268") — bewijs: hetzelfde drieluik; `t.blok` op de
      labelkolom (w=165, `rekt` -, `blok=true`)
- [x] Auth-titels gecentreerd, "Wachtwoord vergeten?" rechts op één regel — bewijs:
      `LoginScreen__Playground.3luik.png`; teruglezing `forgot` FILL 390, `counterAxisAlignItems`
      MAX, tekst x 250–410; grof 3,29 → 3,01
- [x] Geen frame stijgt meer dan 0,1 — bewijs: `beeld-verschillen.json`, grootste stijging +0,02
      (WorkoutDetail Niet Gevonden, ruis)
- [x] Alle selftests groen — bewijs: `figma:poort:selftest` 30/30, `figma:check:selftest` 44/44,
      `parity:selftest` groen, `instance-tekst --selftest` 5/5
- [x] De twaalf instance-frames dalen na de publicatie — bewijs: `beeld-verschillen.json` na de herbouw van 2026-09-09 (avond): ActivePhase Landscape 3,36 → 2,96, Samenvatting 2,00 → 1,66, Playground 3,04 → 2,82, Zonder Hartslagband 2,96 → 2,74, Doel Afstand 2,91 → 2,86, IdlePhase ×3 −0,02 tot −0,04; ResetPassword ×2 al op de vloer; Doel Bereikt +0,12 door de gerandomiseerde confetti. Tegen het origineel: 16 beter, 7 gelijk, 1 slechter; som grof 77,82 → 74,10
- [x] Geen wees-property in de library — bewijs: `figma:check` `[eigenschappen]` 36 tekst-properties over 22 componenten, elk met een node; 73 verwijderd door de herbouw, nameting in Figma 0 zonder node, 0 dubbele stammen; alle 45 op `CURRENT`

## Een component bijwerken — Figma beslist, code bewaart

Besluit Jeroen, 2026-09-09. Code blijft het bestand dat de app bouwt; de **wijziging** wordt in
Figma gemaakt en gaat zo rond:

1. Wijzig in **de library-file** (`QkRgMc7Quqtbow71DiYa1n`), op de variant. Nooit op een
   scherm-instance in *Screens v2*: die is een gegenereerde kopie, een override erop bestaat
   alleen daar.
2. Manifest verversen → `figma:check`: de **bouwhash-poort** meldt welke nodes handwerk dragen.
   Dat is de wijzigingslijst, geen drift.
3. Omzetten in code met de scoped `figma-naar-code` skill (`apps/rowtrack/.claude/skills/`).
4. Herbouwen (update in place, keys blijven) en **parity én beeld op nul** eisen: dat bewijst
   de rondgang. Een verschil dat blijft staan is een eigenschap die de keten nog niet draagt —
   vandaag: C, D, E, F, G, J, I hierboven.
5. Jeroen publiceert; de schermen volgen bij de eerstvolgende schermherbouw.

Een bewerking die 3 en 4 overslaat, overleeft de volgende herbouw niet. Dat was het risico uit
HANDOFF 2026-09-08; het is nu de tegenproef.

## Waar de lessen landen

| Les | Plaats |
|---|---|
| Stretch is geen intentie voor tekst; twee breedtes; uitlijning reist mee; drie stille no-ops | `code-naar-figma/SKILL.md` principe 1 en 1c (umanex-os) · `LEARNINGS.md` umanex-os `# Skill` |
| Een slot is elke tekst die per gebruiksplek verschilt; tel het vóór de bouw, ná de terugval-toets | `code-naar-figma/SKILL.md` Doel-poort · `LEARNINGS.md` umanex-os `# Skill` · `scripts/instance-tekst.mjs` |
| Vijf DOM-eigenschappen buiten bereik van de walker | `apps/rowtrack/LEARNINGS.md` · `scripts/walker-blindvlekken.mjs` · zes BACKLOG-items |
| Import-wachtrij kan vastlopen; `layoutAlign`-no-op; `addComponentProperty` hernoemt stil | `apps/rowtrack/CLAUDE.md` eigenaardigheid 8, 9 en 10 · builder · `[eigenschappen]`-as |
| Storybook is de aangenomen waarheid | toestel-ronde-item, rij 6 |
| De keten hoort ooit hoger, op de trigger | `BACKLOG.md` (root), extractie-item |
| Stories zijn het variantmodel (D) | kandidaat-promotie naar `nieuw-component`, niet gedaan |

## Beslissingsgeschiedenis

- 2026-09-09: Jeroen — de keten blijft in rowtrack; extraheren pas bij een tweede consumer die
  de aannames breekt. Figma beslist, code bewaart. Deze ronde: classificeren, lessen, de eerste
  builder-fix (A+B) met beeld als rechter.
- 2026-09-09: onder het bouwen bleek de oorzaak van A niet `textAutoResize` (BACKLOG-item van
  eerder die dag) maar `rekt`; het item is bijgesteld, niet stil vervangen.
- 2026-09-09: de eerste telling van klasse C (119) is gecorrigeerd naar 23 ná de terugval-toets;
  de skill-tekst en de LEARNINGS-entry noemen beide getallen en waarom.
