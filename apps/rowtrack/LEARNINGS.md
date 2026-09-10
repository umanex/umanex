# LEARNINGS.md — waargenomen fouten (staging)

Dit bestand is de **rauwe vangst** van momenten waarop een skill of werkprincipe faalde. Het staat los van CLAUDE.md: CLAUDE.md blijft schone instructie, LEARNINGS.md is de staging-area waaruit bewezen regels later naar de juiste CLAUDE.md **promoveren**.

Entries worden toegevoegd via de `vastleggen` skill — niet handmatig bewerken tenzij je een status bijwerkt.

## Waarom dit bestaat

Lessen verdampen anders. Door de fout én de **letterlijke input die hem uitlokte** te bewaren, wordt elke entry later herbruikbaar als verificatie-test: speel de input opnieuw af in een fresh sessie en kijk of de fout weg is.

## Statussen

Een entry doorloopt drie statussen:

- `open` — vastgelegd, nog niet gefixt.
- `verified` — gefixt én de input opnieuw getest in een fresh sessie; de fout is weg.
- `promoted` — de regel is gehard naar de juiste CLAUDE.md-laag (globaal / klant / project).

Geen score, geen severity, geen categorie. Bewust minimaal — capture moet wrijvingsloos zijn.

## Format

Elke entry staat onder een laag-header (`# Globaal`, `# Klant — {naam}`, `# Project — {app}`) en heeft deze vorm:

```
## YYYY-MM-DD — {skill of principe dat faalde}
- **Input:** {letterlijke prompt of bestandspad dat de fout uitlokte}
- **Fout:** {wat er misging, 1-2 zinnen}
- **Status:** open
```

<!-- De vastleggen skill voegt hieronder de juiste laag-header toe bij de eerste capture. -->

# Project — rowtrack

## 2026-09-09 — verify (tegenproef) — een poort die twee bronnen samenvoegt, toetste er één
- **Input:** `scripts/geometry-parity.mjs:347-352` (stand vóór vandaag): `if (existsSync(schermPad)) { const sch = JSON.parse(...); fig.paginas = {...fig.paginas, ...sch.paginas}; }` gevolgd door `if (fig.schema !== 2) { ... process.exit(2) }`. Aangewezen door een ontwerppanel bij de voorbereiding van klasse J; het BACKLOG-item van die dag noemt het letterlijk: *"`sch.schema` wordt nergens gelezen"*.
- **Fout:** De as heeft twee invoerbestanden — `geometry.figma.json` (library) en `geometry.schermen.json` (schermen) — en één schemacontrole, op het eerste. Het tweede werd ervóór ingevouwen. Een schermlezing van een ouder schema reisde dus mee met de codering van een nieuwer, zonder één woord, en juist de schermen zijn de kant waar de gemeten klasse het zichtbaarst is. De vorm is generiek: **een controle staat bij de bron waar hij geschreven werd, niet bij elke bron die er sindsdien bij kwam.** Herkenningsteken: een `existsSync`-blok dat een tweede bestand invoegt vlak vóór een validatie die alleen het eerste noemt. De fix is de validatie tot functie maken en hem op elke bron aanroepen, vóór het samenvoegen — plus een tegenproef die de tweede bron op beide kanten draait, want een poort die altijd weigert is niet te onderscheiden van een poort die weigert om de juiste reden.
- **Status:** open

## 2026-09-09 — verify (tegenproef) — de tegenproef ZOCHT het defect, en verdween ermee
- **Input:** `node scripts/instance-tekst.mjs --selftest` ná het sluiten van klasse C. Uitvoer: `XX er is een stil geval om te muteren`, waarna de mutatie die het getal omlaag moest duwen niet meer draaide. Vóór de fix stond de teller op 23 stille teksten en slaagde dezelfde zelftest.
- **Fout:** De zelftest nam `a.stil[0]` — een bestaand defect uit de echte meting — en repareerde dat om te bewijzen dat de as beweegt. Zodra `markeerAfgeleideSlots` de teller op 0 zette, was er niets meer om te repareren en was de as onbewijsbaar op precies het moment dat hij groen werd. De vorm is generiek en bijt bij élke ratel die naar nul convergeert: **een tegenproef die zijn defect uit de meting HAALT, sterft aan het succes van de fix.** Hij moet het defect zelf MAKEN — hier: een gebruikt slot weghalen (0 → 21), en het daarna terugzetten (21 → 0). Dat is bovendien een scherpere claim dan "minder", want de exacte terugkeer sluit uit dat de as op iets anders reageert. Tweede les uit dezelfde ronde: de oude eis *"precies één minder"* klopte alleen zolang elk stil geval zijn eigen pad had — één library-node bedient 21 KpiRow-instances.
- **Status:** open

## 2026-09-09 — figma-build-spec (walker) — vijf DOM-eigenschappen buiten bereik, en niets kon ze missen
- **Input:** `node scripts/walker-blindvlekken.mjs --verbose` (op `storybook-static` van 2026-09-09, 42 schermstories): rand 110 · placeholder 4 · gescrold 11 · overloop 15 · inline 3. Zichtbaar in `figma/beeld-diff/IdlePhase__Playground.3luik.png` (wheel vanaf item 1, lijst onder de knop door; segment-rij als volledige doos), `LoginScreen__Playground.3luik.png` (leeg e-mailveld; "Registreer" over "Nog geen account?") en `ActivePhase__Playground.3luik.png` ("RESTERENDE TIJD" smaller: style `segmentActive` met −0,24 px tracking waar de meting 3,2 px zegt — 24 van 324 tekstnodes met style).
- **Fout:** De walker leest per node alleen `borderTopWidth`, geen `scrollTop`, geen `<input placeholder>`, alleen eigen tekstnodes (een geneste `<Text>` wordt frame + los label zonder inline-stroom) en kiest de text style op familie+grootte zonder tracking. Elk van die vijf is een eigenschap die niet in de spec komt, dus de builder kan hem niet bouwen én parity — die op dezelfde meting rust — kan hem niet missen; een lege meting was hier niet te onderscheiden van "geen probleem". Alleen het beeld vond ze.
- **Status:** open
